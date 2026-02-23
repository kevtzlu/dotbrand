# LAYER 3.2: CASE SIMILARITY MATCHING v1.0 (PRODUCTION)

**版本**: 1.0  
**狀態**: PRODUCTION  
**最後更新**: 2026-02-06  
**用途**: 定義如何計算新項目與參考案例的相似度評分，並根據相似度等級確定置信度

---

## 目錄

1. [簡介](#簡介)
2. [相似度計算框架](#相似度計算框架)
3. [6 個相似度維度](#6-個相似度維度)
4. [相似度評分計算](#相似度評分計算)
5. [置信度等級](#置信度等級)
6. [計算示例](#計算示例)
7. [實施指南](#實施指南)

---

## 簡介

### 目的

案例相似度匹配是 **LAYER 3: Case-Based Reasoning (CBR)** 系統的核心。通過計算新項目與案例庫中所有案例的相似度，我們可以：

1. **識別最相似的參考案例** - 找到最接近的歷史項目
2. **確定置信度等級** - 評估估算的可靠性
3. **決定調整策略** - 根據相似度應用不同的調整方法
4. **與 GC 進行驗證** - 基於相似度決定是否需要 double check

### 核心原則

- ✅ **多維度**: 考慮 6 個關鍵維度
- ✅ **加權**: 不同維度的重要性不同
- ✅ **可解釋**: 每個維度的計算都可以解釋
- ✅ **可驗證**: 結果可以被 GC 驗證

---

## 相似度計算框架

### 總體相似度公式

```
Overall Similarity Score = 
    0.25 × Building_Type_Match +
    0.20 × Location_Similarity +
    0.20 × Size_Similarity +
    0.15 × Duration_Similarity +
    0.10 × Renovation_Level_Match +
    0.10 × Complexity_Similarity

Score Range: 0 - 100%
```

### 權重說明

| 維度 | 權重 | 說明 |
|------|------|------|
| **Building Type Match** | 25% | 最重要 - 建築類型決定基本成本結構 |
| **Location Similarity** | 20% | 很重要 - 地區乘數和法規差異很大 |
| **Size Similarity** | 20% | 很重要 - 規模影響單位成本 |
| **Duration Similarity** | 15% | 中等 - 工期影響間接成本 |
| **Renovation Level Match** | 10% | 中等 - 改造強度影響成本 |
| **Complexity Similarity** | 10% | 中等 - 複雜度影響溢價 |

---

## 6 個相似度維度

### 1. 建築類型匹配 (Building Type Match)

**定義**: 新項目與參考案例的建築類型是否相同

**計算方法**:

```python
if new_project.building_type == reference_case.building_type:
    building_type_match = 1.00  # 100% - 完全匹配
elif new_project.building_type in same_category:
    building_type_match = 0.85  # 85% - 同類別
else:
    building_type_match = 0.50  # 50% - 不同類別
```

**建築類型分類**:

```
Healthcare:
  - Behavioral Health Center
  - General Hospital
  - Medical Office Building (MOB)
  - Ambulatory Surgery Center (ASC)
  - Specialty Clinic

Warehouse:
  - Standard Warehouse
  - High-Bay Warehouse
  - Climate-Controlled Warehouse
  - Specialized Warehouse

Commercial:
  - Office Building
  - Retail Center
  - Mixed-Use Building
```

**同類別定義**:
- Healthcare 內部: 0.85 (例如 Behavioral Health → MOB)
- Warehouse 內部: 0.85 (例如 Standard → High-Bay)
- Commercial 內部: 0.85 (例如 Office → Mixed-Use)
- 不同類別: 0.50 (例如 Healthcare → Warehouse)

**示例**:
```
新項目: Behavioral Health Center
參考案例 1: Behavioral Health Center → 1.00 (完全匹配)
參考案例 2: Medical Office Building → 0.85 (同類別)
參考案例 3: Standard Warehouse → 0.50 (不同類別)
```

---

### 2. 地點相似度 (Location Similarity)

**定義**: 新項目與參考案例的地點相似程度

**計算方法**:

```python
# Step 1: 計算地區乘數差異
regional_multiplier_diff = abs(
    new_project.regional_multiplier - 
    reference_case.regional_multiplier
)

# Step 2: 計算相似度 (基於乘數差異)
if regional_multiplier_diff <= 0.05:
    location_similarity = 1.00  # 100% - 非常相似
elif regional_multiplier_diff <= 0.10:
    location_similarity = 0.90  # 90%
elif regional_multiplier_diff <= 0.15:
    location_similarity = 0.80  # 80%
elif regional_multiplier_diff <= 0.20:
    location_similarity = 0.70  # 70%
else:
    location_similarity = 0.50  # 50% - 差異很大

# Step 3: 考慮法規溢價差異
code_premium_diff = abs(
    new_project.code_premium - 
    reference_case.code_premium
)

if code_premium_diff > 0.10:
    location_similarity *= 0.9  # 降低 10%
```

**Regional Multiplier 範例**:
```
CA Coastal (SF, LA): 1.25
CA Inland (Inland Empire): 1.15
TX (Houston): 1.00
NY (NYC): 1.30
National Average: 1.00

相似度計算示例:
新項目 (CA Inland, 1.15) vs 參考案例 (CA Inland, 1.15)
差異: 0.00 → 相似度: 1.00 (100%)

新項目 (CA Inland, 1.15) vs 參考案例 (CA Coastal, 1.25)
差異: 0.10 → 相似度: 0.90 (90%)

新項目 (TX, 1.00) vs 參考案例 (CA Coastal, 1.25)
差異: 0.25 → 相似度: 0.50 (50%)
```

---

### 3. 規模相似度 (Size Similarity)

**定義**: 新項目與參考案例的建築面積相似程度

**計算方法**:

```python
# Step 1: 計算規模比例
size_ratio = new_project.building_area / reference_case.building_area

# Step 2: 計算相似度 (基於規模比例)
if 0.9 <= size_ratio <= 1.1:
    size_similarity = 1.00  # 100% - 非常相似 (±10%)
elif 0.8 <= size_ratio <= 1.2:
    size_similarity = 0.95  # 95% - 相似 (±20%)
elif 0.7 <= size_ratio <= 1.3:
    size_similarity = 0.85  # 85% - 較相似 (±30%)
elif 0.6 <= size_ratio <= 1.4:
    size_similarity = 0.70  # 70% - 中等相似 (±40%)
else:
    size_similarity = 0.50  # 50% - 差異很大 (>40%)
```

**規模相似度表**:

| 規模比例 | 相似度 | 說明 |
|---------|--------|------|
| 0.90 - 1.10 | 100% | 非常相似 (±10%) |
| 0.80 - 1.20 | 95% | 相似 (±20%) |
| 0.70 - 1.30 | 85% | 較相似 (±30%) |
| 0.60 - 1.40 | 70% | 中等相似 (±40%) |
| < 0.60 或 > 1.40 | 50% | 差異很大 (>40%) |

**示例**:
```
新項目: 35,062 SF
參考案例 1: 35,000 SF → 比例: 1.00 → 相似度: 100%
參考案例 2: 40,000 SF → 比例: 0.88 → 相似度: 95%
參考案例 3: 50,000 SF → 比例: 0.70 → 相似度: 85%
參考案例 4: 100,000 SF → 比例: 0.35 → 相似度: 50%
```

---

### 4. 工期相似度 (Duration Similarity)

**定義**: 新項目與參考案例的施工工期相似程度

**計算方法**:

```python
# Step 1: 計算工期差異 (月數)
duration_diff = abs(
    new_project.duration - 
    reference_case.duration
)

# Step 2: 計算相似度 (基於工期差異)
if duration_diff <= 2:
    duration_similarity = 1.00  # 100% - 非常相似 (±2 月)
elif duration_diff <= 4:
    duration_similarity = 0.95  # 95% - 相似 (±4 月)
elif duration_diff <= 6:
    duration_similarity = 0.85  # 85% - 較相似 (±6 月)
elif duration_diff <= 12:
    duration_similarity = 0.70  # 70% - 中等相似 (±12 月)
else:
    duration_similarity = 0.50  # 50% - 差異很大 (>12 月)
```

**工期相似度表**:

| 工期差異 | 相似度 | 說明 |
|---------|--------|------|
| ≤ 2 月 | 100% | 非常相似 |
| ≤ 4 月 | 95% | 相似 |
| ≤ 6 月 | 85% | 較相似 |
| ≤ 12 月 | 70% | 中等相似 |
| > 12 月 | 50% | 差異很大 |

**示例**:
```
新項目: 20 個月
參考案例 1: 20 個月 → 差異: 0 → 相似度: 100%
參考案例 2: 22 個月 → 差異: 2 → 相似度: 100%
參考案例 3: 24 個月 → 差異: 4 → 相似度: 95%
參考案例 4: 30 個月 → 差異: 10 → 相似度: 70%
參考案例 5: 40 個月 → 差異: 20 → 相似度: 50%
```

---

### 5. 改造等級匹配 (Renovation Level Match)

**定義**: 新項目與參考案例的改造強度是否相同

**計算方法**:

```python
# 對於新建項目
if new_project.project_type == "New Construction":
    if reference_case.project_type == "New Construction":
        renovation_level_match = 1.00  # 100% - 都是新建
    else:
        renovation_level_match = 0.50  # 50% - 一個新建，一個改造

# 對於改造項目
elif new_project.project_type == "Renovation":
    if reference_case.project_type != "Renovation":
        renovation_level_match = 0.50  # 50% - 一個改造，一個新建
    else:
        # 計算改造等級差異
        level_diff = abs(
            new_project.renovation_level - 
            reference_case.renovation_level
        )
        
        if level_diff == 0:
            renovation_level_match = 1.00  # 100% - 等級相同
        elif level_diff == 1:
            renovation_level_match = 0.85  # 85% - 等級相差 1
        elif level_diff == 2:
            renovation_level_match = 0.70  # 70% - 等級相差 2
        else:
            renovation_level_match = 0.50  # 50% - 等級相差 3+
```

**改造等級匹配表**:

| 情況 | 相似度 | 說明 |
|------|--------|------|
| 都是新建 | 100% | 完全匹配 |
| 改造等級相同 | 100% | 完全匹配 |
| 改造等級相差 1 | 85% | 較相似 |
| 改造等級相差 2 | 70% | 中等相似 |
| 改造等級相差 3+ | 50% | 差異很大 |
| 一個新建，一個改造 | 50% | 差異很大 |

**示例**:
```
新項目: Renovation Level 1
參考案例 1: Renovation Level 1 → 相似度: 100%
參考案例 2: Renovation Level 2 → 相似度: 85%
參考案例 3: Renovation Level 3 → 相似度: 70%
參考案例 4: New Construction → 相似度: 50%
```

---

### 6. 複雜度相似度 (Complexity Similarity)

**定義**: 新項目與參考案例的項目複雜度相似程度

**計算方法**:

```python
# Step 1: 計算複雜度評分差異
complexity_diff = abs(
    new_project.complexity_score - 
    reference_case.complexity_score
)

# Step 2: 計算相似度 (基於複雜度差異)
if complexity_diff <= 1:
    complexity_similarity = 1.00  # 100% - 非常相似
elif complexity_diff <= 2:
    complexity_similarity = 0.95  # 95% - 相似
elif complexity_diff <= 3:
    complexity_similarity = 0.85  # 85% - 較相似
elif complexity_diff <= 4:
    complexity_similarity = 0.70  # 70% - 中等相似
else:
    complexity_similarity = 0.50  # 50% - 差異很大
```

**複雜度相似度表**:

| 複雜度差異 | 相似度 | 說明 |
|----------|--------|------|
| ≤ 1 分 | 100% | 非常相似 |
| ≤ 2 分 | 95% | 相似 |
| ≤ 3 分 | 85% | 較相似 |
| ≤ 4 分 | 70% | 中等相似 |
| > 4 分 | 50% | 差異很大 |

**複雜度評分範圍**: 8-16 分

**示例**:
```
新項目: 複雜度評分 9
參考案例 1: 複雜度評分 9 → 差異: 0 → 相似度: 100%
參考案例 2: 複雜度評分 10 → 差異: 1 → 相似度: 100%
參考案例 3: 複雜度評分 11 → 差異: 2 → 相似度: 95%
參考案例 4: 複雜度評分 12 → 差異: 3 → 相似度: 85%
參考案例 5: 複雜度評分 14 → 差異: 5 → 相似度: 50%
```

---

## 相似度評分計算

### 完整計算公式

```
Overall Similarity Score = 
    0.25 × Building_Type_Match +
    0.20 × Location_Similarity +
    0.20 × Size_Similarity +
    0.15 × Duration_Similarity +
    0.10 × Renovation_Level_Match +
    0.10 × Complexity_Similarity
```

### 計算步驟

**Step 1**: 計算 Building Type Match (0-1)
**Step 2**: 計算 Location Similarity (0-1)
**Step 3**: 計算 Size Similarity (0-1)
**Step 4**: 計算 Duration Similarity (0-1)
**Step 5**: 計算 Renovation Level Match (0-1)
**Step 6**: 計算 Complexity Similarity (0-1)
**Step 7**: 應用加權公式

### 計算示例

**新項目特性**:
```
Building Type: Behavioral Health Center
Location: CA Inland (Regional Multiplier: 1.15)
Building Area: 35,062 SF
Duration: 20 months
Project Type: Renovation Level 1
Complexity Score: 9
```

**參考案例 1: Colton Hospital II**
```
Building Type: Behavioral Health Center
Location: CA Inland (Regional Multiplier: 1.15)
Building Area: 35,062 SF
Duration: 20 months
Project Type: Renovation Level 1
Complexity Score: 9
```

**相似度計算**:
```
Building Type Match: 1.00 (完全匹配)
Location Similarity: 1.00 (Regional Multiplier 相同)
Size Similarity: 1.00 (建築面積相同)
Duration Similarity: 1.00 (工期相同)
Renovation Level Match: 1.00 (改造等級相同)
Complexity Similarity: 1.00 (複雜度評分相同)

Overall Similarity Score = 
    0.25 × 1.00 +
    0.20 × 1.00 +
    0.20 × 1.00 +
    0.15 × 1.00 +
    0.10 × 1.00 +
    0.10 × 1.00
= 1.00 = 100%
```

---

### 計算示例 2

**新項目特性**:
```
Building Type: Medical Office Building (MOB)
Location: CA Coastal (Regional Multiplier: 1.25)
Building Area: 50,000 SF
Duration: 18 months
Project Type: Renovation Level 2
Complexity Score: 11
```

**參考案例: Colton Hospital II**
```
Building Type: Behavioral Health Center
Location: CA Inland (Regional Multiplier: 1.15)
Building Area: 35,062 SF
Duration: 20 months
Project Type: Renovation Level 1
Complexity Score: 9
```

**相似度計算**:
```
Building Type Match: 0.85 (同類別 - Healthcare)
Location Similarity: 0.80 (Regional Multiplier 差異: 0.10)
Size Similarity: 0.85 (規模比例: 1.42 - 相差 42%)
Duration Similarity: 0.95 (工期差異: 2 個月)
Renovation Level Match: 0.85 (改造等級相差 1)
Complexity Similarity: 0.95 (複雜度評分差異: 2 分)

Overall Similarity Score = 
    0.25 × 0.85 +
    0.20 × 0.80 +
    0.20 × 0.85 +
    0.15 × 0.95 +
    0.10 × 0.85 +
    0.10 × 0.95
= 0.2125 + 0.16 + 0.17 + 0.1425 + 0.085 + 0.095
= 0.8575 = 85.75%
```

---

## 置信度等級

### 相似度等級定義

| 相似度範圍 | 等級 | 置信度 | 建議 |
|----------|------|--------|------|
| **≥ 85%** | **VERY HIGH** | **95%+** | ✅ 使用參考案例，最小調整 |
| **70-85%** | **HIGH** | **85-95%** | ⚠️ 使用參考案例，需要 GC double check |
| **55-70%** | **MEDIUM** | **70-85%** | ⚠️ 使用多個案例平均，詳細 GC double check |
| **< 55%** | **LOW** | **60-75%** | ❌ 使用 LAYER 1 核心引擎 + LAYER 2 知識 |

### 置信度等級說明

#### **VERY HIGH (≥ 85%)**

**特徵**:
- 新項目與參考案例在所有關鍵維度上都非常相似
- 可以直接使用參考案例的成本/SF
- 只需要進行微調整 (±5%)

**建議**:
- ✅ 使用參考案例的成本/SF 作為基準
- ✅ 應用微調整因子 (±5%)
- ✅ 置信度: 95%+
- ✅ 無需 GC double check (可選)

**示例**:
```
新項目 vs Colton Hospital II
相似度: 100%
建議成本/SF: $253 (Colton 實際)
調整範圍: $240-$266 (±5%)
置信度: 95%+
```

---

#### **HIGH (70-85%)**

**特徵**:
- 新項目與參考案例在大多數維度上相似
- 存在某些差異，但不是主要因素
- 可以使用參考案例作為基準，但需要調整

**建議**:
- ✅ 使用參考案例的成本/SF 作為基準
- ✅ 應用調整因子 (±10-15%)
- ✅ 置信度: 85-95%
- ⚠️ **需要 GC double check**

**GC Double Check 清單**:
1. 確認參考案例的相似性
2. 驗證差異點的影響
3. 確認調整因子的合理性
4. 提供反饋和修正

**示例**:
```
新項目 vs Colton Hospital II
相似度: 85.75%
建議成本/SF: $253 (Colton 實際)
調整因子: 0.90-1.10 (±10%)
調整後成本/SF: $228-$278
置信度: 85-95%
需要 GC double check: YES
```

---

#### **MEDIUM (55-70%)**

**特徵**:
- 新項目與參考案例存在中等程度的差異
- 可能需要使用多個案例進行平均
- 需要詳細的調整和驗證

**建議**:
- ✅ 使用多個最相似案例的成本/SF 進行平均
- ✅ 應用調整因子 (±20-30%)
- ✅ 置信度: 70-85%
- ⚠️ **需要詳細 GC double check**

**GC Double Check 清單**:
1. 呈現 Top 3 最相似案例
2. 解釋為什麼選擇這些案例
3. 詳細說明差異點和調整因子
4. 討論不確定性和風險
5. 獲取 GC 的詳細反饋

**示例**:
```
新項目特性: 商業辦公樓 (6 層), 100,000 SF, 18 個月
Top 3 最相似案例:
  1. Advantech HQ (相似度 68%) - $210/SF
  2. Office Building A (相似度 62%) - $195/SF
  3. Office Building B (相似度 58%) - $205/SF

平均成本/SF: $203
調整因子: 0.85-1.15 (±15%)
調整後成本/SF: $172-$234
置信度: 70-85%
需要詳細 GC double check: YES
```

---

#### **LOW (< 55%)**

**特徵**:
- 新項目與現有案例差異很大
- 無法找到充分相似的參考案例
- 需要回到 LAYER 1 核心估算引擎

**建議**:
- ✅ 使用 LAYER 1 核心估算引擎
- ✅ 參考 LAYER 2 領域特定知識
- ✅ 置信度: 60-75%
- ⚠️ **需要詳細 GC double check + 現場評估**

**GC Double Check 清單**:
1. 解釋為什麼無法找到相似案例
2. 呈現 LAYER 1 核心估算結果
3. 詳細說明所有假設和調整
4. 識別主要風險和不確定性
5. 建議進行現場評估或詳細設計審查
6. 獲取 GC 的詳細反饋和修正

**示例**:
```
新項目特性: 特殊用途設施 (研究中心), 75,000 SF, 24 個月
最相似案例相似度: 52% (< 55%)

建議:
  1. 使用 LAYER 1 核心估算引擎
  2. 基準成本/SF: $280-$320 (基於建築類型)
  3. 應用複雜度乘數: 1.8x (高複雜度)
  4. 應用地區調整: 1.15x
  5. 應用系統溢價: +12%
  
估算成本/SF: $280 × 1.8 × 1.15 × 1.12 = $651/SF
置信度: 60-75%
需要詳細 GC double check + 現場評估: YES
```

---

## 實施指南

### Python 實現示例

```python
def calculate_similarity_score(new_project, reference_case):
    """
    計算新項目與參考案例的相似度評分
    """
    
    # 1. Building Type Match
    building_type_match = calculate_building_type_match(
        new_project.building_type,
        reference_case.building_type
    )
    
    # 2. Location Similarity
    location_similarity = calculate_location_similarity(
        new_project.regional_multiplier,
        reference_case.regional_multiplier,
        new_project.code_premium,
        reference_case.code_premium
    )
    
    # 3. Size Similarity
    size_similarity = calculate_size_similarity(
        new_project.building_area,
        reference_case.building_area
    )
    
    # 4. Duration Similarity
    duration_similarity = calculate_duration_similarity(
        new_project.duration,
        reference_case.duration
    )
    
    # 5. Renovation Level Match
    renovation_level_match = calculate_renovation_level_match(
        new_project.project_type,
        new_project.renovation_level,
        reference_case.project_type,
        reference_case.renovation_level
    )
    
    # 6. Complexity Similarity
    complexity_similarity = calculate_complexity_similarity(
        new_project.complexity_score,
        reference_case.complexity_score
    )
    
    # Calculate Overall Similarity Score
    overall_score = (
        0.25 * building_type_match +
        0.20 * location_similarity +
        0.20 * size_similarity +
        0.15 * duration_similarity +
        0.10 * renovation_level_match +
        0.10 * complexity_similarity
    )
    
    # Determine Confidence Level
    confidence_level = determine_confidence_level(overall_score)
    
    return {
        'overall_score': overall_score,
        'confidence_level': confidence_level,
        'component_scores': {
            'building_type_match': building_type_match,
            'location_similarity': location_similarity,
            'size_similarity': size_similarity,
            'duration_similarity': duration_similarity,
            'renovation_level_match': renovation_level_match,
            'complexity_similarity': complexity_similarity
        }
    }


def determine_confidence_level(overall_score):
    """
    根據相似度評分確定置信度等級
    """
    if overall_score >= 0.85:
        return {
            'level': 'VERY HIGH',
            'confidence': '95%+',
            'recommendation': 'Use reference case with minimal adjustment'
        }
    elif overall_score >= 0.70:
        return {
            'level': 'HIGH',
            'confidence': '85-95%',
            'recommendation': 'Use reference case with adjustment, GC double check required'
        }
    elif overall_score >= 0.55:
        return {
            'level': 'MEDIUM',
            'confidence': '70-85%',
            'recommendation': 'Use multiple cases average, detailed GC double check required'
        }
    else:
        return {
            'level': 'LOW',
            'confidence': '60-75%',
            'recommendation': 'Use LAYER 1 core engine + LAYER 2 knowledge, detailed GC double check + site assessment required'
        }
```

---

**END OF LAYER 3.2: CASE SIMILARITY MATCHING v1.0 (PRODUCTION)**
