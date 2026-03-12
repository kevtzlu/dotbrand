# Estimait — 自動優化估價準確度：Feedback Loop 技術設計文件

**版本：** v1.0  
**日期：** 2026-03-06  
**用途：** 產品規劃會議 / 技術評估

---

## 一、需求背景

**目標：** 讓系統根據使用者的歷史修正習慣，自動提升未來估價的準確度。

**使用者體驗流程：**
```
AI 完成估價
    → 邀請使用者確認或修改估價數字
    → 記錄使用者的修正內容
    → 詢問修正原因（提供快速選項）
    → 系統學習這位使用者的偏好
    → 下次估價自動套用個人化校正
```

**設計原則：**
- 不需要額外 ML 基礎設施即可上線（Phase 1）
- 資料設計從第一天就為進階功能預留空間
- 對使用者透明：何時套用了校正，要明確告知
- 異常值自動過濾，避免特殊案例汙染模型

---

## 二、整體架構概覽

```
┌─────────────────────────────────────────────────────┐
│                    使用者介面                          │
│  Stage F 完成後 → Feedback Panel（修正 + 填寫原因）    │
└────────────────────┬────────────────────────────────┘
                     │ POST /api/feedback
┌────────────────────▼────────────────────────────────┐
│                  Feedback API                        │
│  1. 寫入 estimation_feedback                         │
│  2. 更新 user_calibration_profile (EMA 加權平均)      │
│  3. (Phase 2) 向量化存入 feedback_embeddings          │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                  Supabase DB                         │
│  estimation_feedback / user_calibration_profile      │
│  feedback_embeddings / global_calibration (view)     │
└────────────────────┬────────────────────────────────┘
                     │ 下次估價時注入
┌────────────────────▼────────────────────────────────┐
│              chat/route.ts (現有系統)                 │
│  getUserCalibration() → 注入 system prompt           │
│  "Based on your X past projects, MEP +12%..."        │
└─────────────────────────────────────────────────────┘
```

---

## 三、一般做法（Phase 1 — 可立即實作）

### 3.1 資料收集

**新增兩張 Supabase 資料表：**

```sql
-- 每次估價後的使用者修正記錄
CREATE TABLE estimation_feedback (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             text NOT NULL,            -- Clerk user ID
  conversation_id     text NOT NULL,
  project_type        text,                     -- WAREHOUSE / HEALTHCARE / COMMERCIAL
  building_type       text,
  location_state      text,                     -- CA / NY / TX...
  gfa_sqft            int,

  original_estimate   jsonb,   -- AI 原始估價 { p10, p50, p80, divisions: {...} }
  corrected_estimate  jsonb,   -- 使用者修正後  { p10, p50, p80, divisions: {...} }
  correction_reason   text,    -- 使用者填寫的原因
  reason_category     text,    -- union_labor / subcontractor_owned / local_code / market_condition / other

  delta_pct           float,   -- 整體修正幅度 % (corrected/original - 1)
  category_deltas     jsonb,   -- 各 Division 修正幅度
  -- {
  --   "division_03_concrete": -0.05,
  --   "division_15_mep": 0.12,
  --   "division_16_electrical": 0.05,
  --   "soft_costs": 0.02
  -- }

  created_at          timestamptz DEFAULT now()
);

-- 每位使用者的聚合校正模式
CREATE TABLE user_calibration_profile (
  user_id                   text PRIMARY KEY,
  building_type_adjustments jsonb,
  -- {
  --   "COMMERCIAL": {
  --     "division_03_concrete": -0.05,
  --     "division_15_mep": 0.12
  --   },
  --   "WAREHOUSE": { ... }
  -- }
  overall_bias              float,   -- 使用者整體傾向（正=保守，負=激進）
  sample_count              int DEFAULT 0,
  last_updated              timestamptz DEFAULT now()
);
```

### 3.2 更新邏輯（Exponential Moving Average）

每次新增一筆 feedback，用 EMA 更新使用者的校正模式，讓越近期的修正權重越高：

```
new_adjustment = old_adjustment × 0.7 + current_delta × 0.3
```

- **優點**：近期修正更重要，自動適應使用者習慣的改變
- **啟動條件**：`sample_count >= 3` 才開始注入（避免單筆特殊案例誤導）
- **異常值過濾**：單次修正超過 ±50% 的記錄不納入均值

### 3.3 前端 Feedback Panel（Stage F 完成後）

**UI 流程：**
1. Stage F 完成後，側邊顯示 **「確認估價」** 面板
2. 列出各分項費用，每項旁邊有 👍 正確 / ✏️ 修正 按鈕
3. 使用者輸入修正金額後，自動彈出原因詢問 Dialog：
   - 🏗️ 地區材料成本較高
   - 👷 工會勞工規定
   - 🔧 自有專業分包商
   - 📋 當地法規要求
   - 📈 市場行情波動
   - 其他（自由填寫）
4. 送出後顯示：「感謝您的回饋，系統將在下次估價中參考您的偏好。」

### 3.4 校正注入（chat/route.ts）

在現有的 `getGCProfile()` 之後，新增校正參數注入：

```typescript
async function getUserCalibration(userId: string, buildingType: string) {
  const { data } = await supabase
    .from("user_calibration_profile")
    .select("building_type_adjustments, overall_bias, sample_count")
    .eq("user_id", userId)
    .single();

  // 至少 3 筆樣本才生效
  if (!data || data.sample_count < 3) return null;
  return data;
}
```

**注入的 System Prompt 內容：**
```
== USER CALIBRATION (Based on 15 past projects) ==
This GC has historically corrected AI estimates as follows:
- MEP (Division 15): typically +12% vs. AI baseline
  Reason: union labor region
- Concrete (Division 03): typically -5%
  Reason: owns concrete subcontractor
- Overall bias: Conservative (+8% overall)

APPLY these adjustments as soft priors. When applied, state:
"Adjusted based on your X past projects' feedback."
```

### 3.5 實作時程

| 工作項目 | 預估時間 |
|---------|---------|
| 建立 Supabase 資料表 | 0.5 天 |
| 新增 `/api/feedback` route | 1 天 |
| 前端 Feedback Panel UI | 2~3 天 |
| `chat/route.ts` 注入邏輯 | 0.5 天 |
| **合計** | **~5 天** |

---

## 四、進階做法（Phase 2~4 — 中長期規劃）

### 4.1 RAG Vector Search on Feedback（Phase 2）

**概念：** 把每次修正記錄向量化，未來相似專案自動召回相關的歷史修正案例。

**原理：**
```
使用者修正記錄 → 轉成文字描述 → OpenAI 向量化 → 存入 Supabase
                                                        ↓
新專案開始 → 專案描述向量化 → 語意搜尋相似的歷史修正 → 召回 Top 5
                                                        ↓
                              注入 System Prompt 作為參考
```

**文字描述範例（用來做向量化）：**
```
"商業辦公室 舊金山灣區 3層樓 45,000 sqft
 MEP 費用低估 12%
 原因：工會勞工要求，比標準高 30%
 Concrete 費用準確
 整體低估 8%"
```

**新增 Supabase 資料表：**

```sql
CREATE TABLE feedback_embeddings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             text,
  feedback_id         uuid REFERENCES estimation_feedback(id),
  description         text,             -- 向量化的文字描述
  embedding           vector(1536),     -- text-embedding-3-small
  correction_summary  jsonb,            -- 召回後直接注入的結構化摘要
  created_at          timestamptz DEFAULT now()
);

-- 向量搜尋函數（跟現有 match_document_chunks 同樣模式）
CREATE FUNCTION match_feedback_embeddings(
  query_embedding     vector(1536),
  user_id_filter      text,
  match_count         int DEFAULT 5
) RETURNS TABLE (
  id uuid, correction_summary jsonb, similarity float
) LANGUAGE sql AS $$
  SELECT id, correction_summary,
         1 - (embedding <=> query_embedding) AS similarity
  FROM feedback_embeddings
  WHERE user_id = user_id_filter
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**完全沿用現有 RAG 架構**，新增一個 `searchRelevantFeedback()` 函數呼叫上述搜尋函數即可。

**優點：** 能捕捉到「這種類型的專案，這位 GC 通常在哪些地方有系統性誤差」，比單純平均更有語境。

**啟動條件：** 累積 ≥ 10 筆修正記錄，語意搜尋才有足夠的候選池。

---

### 4.2 Fine-tuning 輕量調整模型（Phase 3）

**概念：** 訓練一個獨立的小型 ML 模型，專門做一件事：給定專案特徵，預測各 Division 需要調整的幅度。

**重要：** 這裡不是 fine-tune Claude，而是一個獨立的輕量回歸模型（XGBoost / GradientBoosting）。

**模型 Input（專案特徵）：**
```python
{
  "building_type": "COMMERCIAL",      # one-hot encoded
  "state": "CA",
  "zip_prefix": "941",                # 地區 (灣區)
  "gfa_sqft": 45000,
  "floors": 3,
  "delivery_method": "design_bid_build",
  "has_mep_upgrade": True,
  "has_structural_work": False,
  "project_duration_weeks": 28
}
```

**模型 Output（各分項調整係數）：**
```python
{
  "division_03_concrete": 0.97,    # 預測應調降 3%
  "division_15_mep": 1.12,         # 預測應調升 12%
  "division_16_electrical": 1.05,
  "soft_costs": 1.02,
  "overall": 1.08
}
```

**技術選擇：**

| 方案 | 技術 | 適用時機 |
|------|------|---------|
| **方案 A（推薦）** | Python FastAPI 微服務 + XGBoost | 平台有 100+ 筆跨用戶資料後 |
| **方案 B（簡化）** | 純 SQL 聚合（Supabase） | 50 筆以內，不需要捕捉 feature 交互效應 |

**方案 B 的 SQL 範例（無需 Python）：**
```sql
-- 計算每個 user + building_type + division 的平均修正幅度
SELECT
  building_type,
  AVG((category_deltas->>'division_15_mep')::float) AS mep_avg_delta,
  COUNT(*) AS sample_count
FROM estimation_feedback
WHERE user_id = $1
  AND building_type = $2
  AND ABS((category_deltas->>'division_15_mep')::float) < 0.5  -- 過濾異常值
GROUP BY building_type
HAVING COUNT(*) >= 5;
```

**模型更新策略：** 每累積 20 筆新 feedback，自動觸發 retraining（可用 GitHub Actions cron job）。

**資料需求：** 每個 building_type 需要 **50~100 筆**修正記錄，才能訓練出有意義的模型。

---

### 4.3 Global Model + Hybrid Blending（Phase 4）

**概念：** 從所有使用者的匿名修正中學習「行業共識」，當個人資料不足時，從平台整體數據借力。

**三層知識架構：**

```
┌─────────────────────────────────────────────┐
│            GLOBAL MODEL（平台層）             │
│  所有使用者匿名修正的聚合                        │
│  e.g. "CA 商辦 MEP 全平台平均低估 8%"          │
├─────────────────────────────────────────────┤
│           SEGMENT MODEL（族群層）              │
│  按 GC 地區 / 建案類型分群                      │
│  e.g. "灣區商辦 GC 的 MEP 修正模式"            │
├─────────────────────────────────────────────┤
│            USER MODEL（個人層）                │
│  這位 GC 自己的歷史修正                         │
│  e.g. "此 GC 因有自有 MEP 子公司，低 15%"      │
└─────────────────────────────────────────────┘
```

**Hybrid Blending 公式：**

```
final_adjustment = α × user_model + (1-α) × global_model

α = min(1.0, sample_count / 30)
```

| 使用者樣本數 | α 值 | 實際效果 |
|------------|------|---------|
| 3 筆 | 0.10 | 90% 參考平台平均 |
| 10 筆 | 0.33 | 67% 平台 + 33% 個人 |
| 20 筆 | 0.67 | 33% 平台 + 67% 個人 |
| 30 筆以上 | 1.00 | 完全個人化 |

**Global Model 的 Supabase Materialized View：**

```sql
CREATE MATERIALIZED VIEW global_calibration AS
SELECT
  building_type,
  jsonb_object_agg(category, avg_delta) AS avg_adjustments,
  COUNT(DISTINCT user_id) AS user_count
FROM (
  SELECT
    building_type,
    jsonb_object_keys(category_deltas) AS category,
    AVG((category_deltas ->> jsonb_object_keys(category_deltas))::float)
      FILTER (WHERE ABS((category_deltas ->> jsonb_object_keys(category_deltas))::float) < 0.5)
      AS avg_delta,
    user_id
  FROM estimation_feedback
  GROUP BY building_type, category, user_id
) agg
GROUP BY building_type
HAVING COUNT(DISTINCT user_id) >= 5;  -- 至少 5 個不同用戶才公開，保護隱私

REFRESH MATERIALIZED VIEW global_calibration;  -- 每日更新
```

**注入 Prompt 的措辭隨信心水準變化：**

```
樣本少（source = "platform_average"）：
"Based on platform-wide data from similar CA commercial projects,
 MEP costs are typically underestimated by ~8%."

混合階段（source = "hybrid"）：
"Based on your 12 past projects combined with platform benchmarks,
 MEP costs have been adjusted +10%."

完全個人化（source = "personal"）：
"Based on your 30+ past projects, applying your personal
 calibration: MEP +12%, Concrete -5%."
```

---

## 五、實施路線圖

```
Phase 1（立即，~5天）
  ✅ Supabase 資料表設計
  ✅ /api/feedback 收集 API
  ✅ 前端 Feedback Panel UI
  ✅ chat/route.ts 注入個人化校正
  目標：建立資料收集基礎

Phase 2（3~6個月後，有 10+ 筆資料）
  ⬜ feedback_embeddings 向量化
  ⬜ searchRelevantFeedback() 語意召回
  目標：讓相似案例的歷史修正自動被參考

Phase 3（6~12個月後，每類型 50+ 筆）
  ⬜ Python 微服務 or SQL 聚合模型
  ⬜ 預測各 Division 調整係數
  ⬜ GitHub Actions 自動 retraining
  目標：捕捉 feature 之間的複雜交互效應

Phase 4（12個月後，跨用戶資料成熟）
  ⬜ Global Materialized View
  ⬜ Hybrid Blending（α 動態混合）
  ⬜ Segment Model（地區 / 類型分群）
  目標：冷啟動新用戶也有準確參考基準
```

---

## 六、關鍵設計原則

| 原則 | 說明 |
|------|------|
| **透明度** | 每次套用了校正，必須在 UI 明確告知用戶 |
| **最小樣本保護** | sample_count < 3 時，校正功能靜默不啟動 |
| **異常值過濾** | 單次修正 > ±50% 不納入統計 |
| **資料隔離** | Phase 1~2 個人資料不混入其他用戶 |
| **向前相容** | Phase 1 的 schema 設計需為 Phase 2~4 預留欄位 |
| **可解釋性** | AI 說明校正來源時，要能指向具體的修正原因 |

---

## 七、最重要的設計決策

> **Phase 1 的 `estimation_feedback` schema 決定了 Phase 2~4 能不能做。**

`category_deltas` 欄位必須在第一天就設計成夠細的 Division 粒度，否則後續所有進階功能都沒有足夠的原材料。

建議最小粒度：
- `division_02_site_work`
- `division_03_concrete`
- `division_05_metals_structural`
- `division_08_openings_glazing`
- `division_09_finishes`
- `division_15_mep` （或拆成 mechanical / electrical / plumbing）
- `division_16_electrical`
- `soft_costs`（A/E fees, permits, contingency）
- `overall`（整體總額）

---

*文件結束*
