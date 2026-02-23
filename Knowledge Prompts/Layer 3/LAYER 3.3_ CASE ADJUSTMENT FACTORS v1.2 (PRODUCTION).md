# LAYER 3.3: CASE ADJUSTMENT FACTORS v1.2 (PRODUCTION)

**Version**: 1.2
**Status**: PRODUCTION
**Last Updated**: 2026-02-18
**Update**: Added Specialized Condition Switches based on Colton II actuals.

---

## 目錄

1. [簡介](#簡介)  
2. [6 類調整因子](#6-類調整因子)  
3. [調整因子應用順序](#調整因子應用順序)  
4. [計算示例](#計算示例)  
5. [驗證和檢查](#驗證和檢查)

---

## 簡介

### 目的

案例調整因子定義了如何根據新項目與參考案例的差異進行成本調整。通過系統化的調整，我們可以：

1. **轉換參考案例** \- 將參考案例的成本調整為新項目的成本  
2. **保持透明度** \- 每個調整都有明確的理由和數值  
3. **減少誤差** \- 基於實際差異進行精確調整  
4. **便於驗證** \- GC 可以驗證每個調整步驟

### 核心原則

- ✅ **系統化**: 按照固定順序應用調整因子  
- ✅ **可解釋**: 每個調整都有明確的理由  
- ✅ **可驗證**: 每個調整都可以被 GC 驗證  
- ✅ **保守**: 在不確定時傾向於保守估計

---

## 6 類調整因子

### 1\. 建築類型調整 (Building Type Adjustment)

**定義**: 根據建築類型的差異進行調整

**調整因子表**:

| 參考案例 | 新項目 | 調整因子 | 說明 |
| :---- | :---- | :---- | :---- |
| **Healthcare** | Healthcare | 1.00x | 相同類型 |
| Healthcare | Healthcare (不同設施) | 0.95-1.05x | 同類型但設施不同 |
| Healthcare | Warehouse | 0.70x | MEP 複雜度大幅降低 |
| Healthcare | Commercial | 0.80x | MEP 複雜度降低 |
| **Warehouse** | Warehouse | 1.00x | 相同類型 |
| Warehouse | Healthcare | 1.30x | MEP 複雜度大幅提高 |
| Warehouse | Commercial | 1.10x | MEP 複雜度提高 |
| **Commercial** | Commercial | 1.00x | 相同類型 |
| Commercial | Healthcare | 1.25x | MEP 複雜度提高 |
| Commercial | Warehouse | 0.90x | MEP 複雜度降低 |

**Healthcare 設施類型調整**:

| 參考案例 | 新項目 | 調整因子 | 說明 |
| :---- | :---- | :---- | :---- |
| Behavioral Health | Behavioral Health | 1.00x | 相同 |
| Behavioral Health | MOB | 0.95x | 略簡單 |
| Behavioral Health | ASC | 0.92x | 更簡單 |
| Behavioral Health | General Hospital | 1.05x | 略複雜 |
| MOB | Behavioral Health | 1.05x | 略複雜 |
| MOB | MOB | 1.00x | 相同 |
| MOB | ASC | 0.98x | 略簡單 |
| General Hospital | Behavioral Health | 0.95x | 略簡單 |
| General Hospital | General Hospital | 1.00x | 相同 |

**計算示例**:

參考案例: Behavioral Health Center (Colton Hospital II)

成本/SF: $253

新項目: Medical Office Building (MOB)

調整因子: 0.95x

調整後成本/SF: $253 × 0.95 \= $240/SF

---

### 2\. 地區調整 (Regional Adjustment)

**定義**: 根據地區乘數差異進行調整

**計算方法**:

Regional Adjustment Factor \= New Project Regional Multiplier / Reference Case Regional Multiplier

示例:

新項目: CA Coastal (Regional Multiplier: 1.25)

參考案例: CA Inland (Regional Multiplier: 1.15)

調整因子: 1.25 / 1.15 \= 1.087x (≈ 1.09x)

**地區乘數表**:

| 地區 | 乘數 |
| :---- | :---- |
| CA Coastal (SF, LA) | 1.25 \- 1.30 |
| CA Inland (Inland Empire) | 1.10 \- 1.15 |
| TX (Houston, Dallas) | 0.95 \- 1.05 |
| NY (NYC) | 1.25 \- 1.35 |
| National Average | 1.00 |

**地區調整因子表**:

| 參考案例地區 | 新項目地區 | 調整因子 | 說明 |
| :---- | :---- | :---- | :---- |
| CA Inland (1.15) | CA Inland (1.15) | 1.00x | 相同地區 |
| CA Inland (1.15) | CA Coastal (1.25) | 1.09x | 成本更高 |
| CA Inland (1.15) | TX (1.00) | 0.87x | 成本更低 |
| CA Coastal (1.25) | CA Inland (1.15) | 0.92x | 成本更低 |
| CA Coastal (1.25) | NY (1.30) | 1.04x | 成本略高 |

**計算示例**:

參考案例: Colton Hospital II (CA Inland, 1.15)

成本/SF: $253

新項目: Medical Office (CA Coastal, 1.25)

調整因子: 1.25 / 1.15 \= 1.087x

調整後成本/SF: $253 × 1.087 \= $275/SF

---

### 3\. 規模調整 (Size Adjustment)

**定義**: 根據建築面積差異進行調整（考慮規模經濟）

**計算方法**:

Size Ratio \= New Project Building Area / Reference Case Building Area

If Size Ratio \> 1.0 (新項目更大):

    Adjustment Factor \= 1.0 \- (Size Ratio \- 1.0) × 0.02

    (每增加 10% 面積，成本/SF 降低 0.2%)

If Size Ratio \< 1.0 (新項目更小):

    Adjustment Factor \= 1.0 \+ (1.0 \- Size Ratio) × 0.02

    (每減少 10% 面積，成本/SF 提高 0.2%)

**規模調整因子表**:

| 規模比例 | 調整因子 | 說明 |
| :---- | :---- | :---- |
| 0.50 (新項目 50% 大小) | 1.10x | 規模劣勢 |
| 0.70 (新項目 70% 大小) | 1.06x | 規模劣勢 |
| 0.90 (新項目 90% 大小) | 1.02x | 輕微規模劣勢 |
| 1.00 (相同大小) | 1.00x | 無調整 |
| 1.10 (新項目 110% 大小) | 0.98x | 輕微規模經濟 |
| 1.30 (新項目 130% 大小) | 0.94x | 規模經濟 |
| 1.50 (新項目 150% 大小) | 0.90x | 規模經濟 |

**計算示例**:

參考案例: Colton Hospital II (35,062 SF)

成本/SF: $253

新項目: Medical Office (50,000 SF)

規模比例: 50,000 / 35,062 \= 1.426

調整因子: 1.0 \- (1.426 \- 1.0) × 0.02 \= 1.0 \- 0.00852 \= 0.991x

調整後成本/SF: $253 × 0.991 \= $251/SF

---

### 4\. 工期調整 (Duration Adjustment)

**定義**: 根據施工工期差異進行調整

**計算方法**:

Duration Difference \= New Project Duration \- Reference Case Duration (months)

Adjustment Factor \= 1.0 \+ (Duration Difference × 0.01)

(每增加 1 個月，成本增加 1%)

**工期調整因子表**:

| 工期差異 | 調整因子 | 說明 |
| :---- | :---- | :---- |
| \-12 個月 (更短) | 0.88x | 工期短，成本更低 |
| \-6 個月 | 0.94x | 工期短 |
| 0 個月 (相同) | 1.00x | 無調整 |
| \+6 個月 | 1.06x | 工期長 |
| \+12 個月 | 1.12x | 工期長，成本更高 |

**計算示例**:

參考案例: Colton Hospital II (20 個月)

成本/SF: $253

新項目: Medical Office (18 個月)

工期差異: 18 \- 20 \= \-2 個月

調整因子: 1.0 \+ (-2 × 0.01) \= 0.98x

調整後成本/SF: $253 × 0.98 \= $248/SF

---

### 5\. 改造強度調整 (Renovation Level Adjustment)

**定義**: 根據改造強度差異進行調整

**調整因子表**:

| 參考案例 | 新項目 | 調整因子 | 說明 |
| :---- | :---- | :---- | :---- |
| Level 1 | Level 1 | 1.00x | 相同 |
| Level 1 | Level 2 | 1.35x | 更多 MEP 更換 |
| Level 1 | Level 3 | 1.70x | 大幅更多 MEP 更換 |
| Level 1 | Level 4 | 2.00x | 完全重建 |
| Level 2 | Level 1 | 0.75x | 更少 MEP 更換 |
| Level 2 | Level 2 | 1.00x | 相同 |
| Level 2 | Level 3 | 1.30x | 更多 MEP 更換 |
| Level 2 | Level 4 | 1.60x | 完全重建 |
| Level 3 | Level 1 | 0.60x | 大幅更少 MEP 更換 |
| Level 3 | Level 2 | 0.77x | 更少 MEP 更換 |
| Level 3 | Level 3 | 1.00x | 相同 |
| Level 3 | Level 4 | 1.25x | 完全重建 |
| Level 4 | Level 1 | 0.50x | 新建 vs 完全重建 |
| Level 4 | Level 2 | 0.63x | 新建 vs 完全重建 |
| Level 4 | Level 3 | 0.80x | 新建 vs 完全重建 |
| Level 4 | Level 4 | 1.00x | 相同 |

**計算示例**:

參考案例: Colton Hospital II (Renovation Level 1, 75% MEP 重用)

成本/SF: $253

新項目: Renovation Level 2 (50% MEP 重用)

調整因子: 1.35x

調整後成本/SF: $253 × 1.35 \= $341/SF

---

### 6\. 複雜度調整 (Complexity Adjustment)

**定義**: 根據項目複雜度差異進行調整  
**6.1. Hybrid Usage Separation Protocol (STRICT ENFORCEMENT)**
1. \- \*\*觸發條件\*\*: When `Project_Type` == "Mixed-Use" OR `Building_Type` contains multiple distinct functions (e.g., Office + Warehouse).
2. \- \*\*Rule\*\*: DO NOT use a single blended $/SF rate for the core calculation. This masks the high cost of the office component.
3. \- \*\*調整因子\*\*:
    1.  **Component A (High Value)**: Calculate Office/HQ area using `Commercial Knowledge Prompt`.
        *   *Key Drivers*: Steel Frame, Curtain Wall, Class A Interiors.
    2.  **Component B (Low Value)**: Calculate Warehouse/Industrial area using `Warehouse Knowledge Prompt`.
        *   *Key Drivers*: Tilt-up, Open Ceiling, Sealed Concrete.
    3.  **Component C (Site)**: Calculate Site Work independently based on Acreage.
        *   *Key Drivers*: Grading, Utilities, Paving.

**Final Formula**: `Total Hard Cost = Cost(A) + Cost(B) + Cost(C)`

**6.2 地質環境校準 (Geotechnical Adjustment)**

1. \- \*\*觸發條件\*\*: 關鍵字 \`Liquefaction\`, \`Rammed Aggregate Piers\`, \`Soft Soil\`。  
2. \- \*\*調整因子\*\*: 基礎工程 (CSI Div 03/31) 自動應用 \*\*1.18x\*\* 乘數。

These logic gates override standard parametric estimates when specific keywords are detected in the BOD or Geotechnical Report.
## 6.1. Behavioral Health Glazing Protocol (行為健康門窗溢價)

*   **Trigger Keywords**: `Behavioral Health`, `Psychiatric`, `Anti-Ligature`, `Mental Health`, `OSHPD 3`
*   **Rationale**: Behavioral health facilities require polycarbonate shields, impact-resistant glazing, and specialized anti-ligature hardware. Standard commercial pricing ($15/SF) is insufficient.
*   **Adjustment Logic**:
    ```python
    IF Project_Type == "Behavioral Health":
        # Apply 2.5x multiplier to standard Div 08 base cost
        Div_08_Cost = Div_08_Base_Cost * 2.5
        
        # Validation: Colton II Div 08 was ~13.5% of total cost ($1.2M)
    ```

## 6.2. Liquefaction Structural Adder (液化風險結構加權)

*   **Trigger Keywords**: `Liquefaction`, `High Seismic`, `Soil Improvement`, `Grouting`, `Micropiles`
*   **Rationale**: Liquefaction zones require ground improvement (grouting/piers) or enhanced structural frames (moment frames) even in renovations.
*   **Adjustment Logic**:
    ```python
    IF "Liquefaction" in Geotechnical_Report OR BOD:
        # Add $15.00/SF specifically for structural/foundation upgrades
        Structural_Adder = Building_Area_SF * 15.00
        
        # Distribute to Div 05 (Steel) and Div 31 (Earthwork)
        Div_05_Cost += Structural_Adder * 0.7
        Div_31_Cost += Structural_Adder * 0.3
    ```

## 6.3. Renovation Rough Carpentry Adder (醫療改造木作加權)

*   **Trigger Keywords**: `Renovation` AND `Healthcare`
*   **Rationale**: Healthcare renovations require extensive in-wall backing for medical equipment, handrails, and wall protection.
*   **Adjustment Logic**:
    ```python
    IF Project_Type == "Healthcare Renovation":
        # Double the standard carpentry budget
        Div_06_Cost = Div_06_Base_Cost * 2.0
    ```

---

**計算方法**:  
Complexity Difference \= New Project Complexity Score \- Reference Case Complexity Score  
Adjustment Factor \= 1.0 \+ (Complexity Difference × 0.05)  
(每增加 1 分複雜度，成本增加 5%)

**複雜度調整因子表**:

| 複雜度差異 | 調整因子 | 說明 |
| :---- | :---- | :---- |
| \-4 分 (更簡單) | 0.80x | 複雜度大幅降低 |
| \-2 分 | 0.90x | 複雜度降低 |
| 0 分 (相同) | 1.00x | 無調整 |
| \+2 分 | 1.10x | 複雜度提高 |
| \+4 分 | 1.20x | 複雜度大幅提高 |

**計算示例**:

參考案例: Colton Hospital II (Complexity Score 9\)

成本/SF: $253

新項目: Complexity Score 11

複雜度差異: 11 \- 9 \= \+2 分

調整因子: 1.0 \+ (2 × 0.05) \= 1.10x

調整後成本/SF: $253 × 1.10 \= $278/SF

### **7\. 單價缺口補償協議 (Non-RSMeans Protocol)**

若缺乏實時價格 API，系統應執行以下搜尋順序：

1. 優先: \`reference/ESTIMAIT\_California\_Real\_Price\_List\_v1.0.md\` (2025 標單實價)。  
2. 次之: 逆向推導 Advantech 案例單價。  
3. 最後: 使用本檔案中定義的調整係數進行估算，並聲明：「數據基於加州近期標單實績，非 RSMeans 數據」。

---

## 調整因子應用順序

### 標準應用順序

**重要**: 調整因子必須按以下順序應用，以確保準確性：

Step 1: 建築類型調整

Step 2: 地區調整

Step 3: 規模調整

Step 4: 工期調整

Step 5: 改造強度調整

Step 6: 複雜度調整

### 應用公式

Adjusted Cost/SF \= 

    Reference Cost/SF 

    × Building Type Adjustment

    × Regional Adjustment

    × Size Adjustment

    × Duration Adjustment

    × Renovation Level Adjustment

    × Complexity Adjustment

### 應用示例

**參考案例**: Colton Hospital II

基準成本/SF: $253

**新項目特性**:

Building Type: Medical Office Building (vs Behavioral Health)

Location: CA Coastal (vs CA Inland)

Building Area: 50,000 SF (vs 35,062 SF)

Duration: 18 個月 (vs 20 個月)

Renovation Level: 2 (vs 1\)

Complexity Score: 11 (vs 9\)

**調整計算**:

Step 1: 建築類型調整 (Healthcare MOB vs Behavioral Health)

  因子: 0.95x

  結果: $253 × 0.95 \= $240/SF

Step 2: 地區調整 (CA Coastal 1.25 vs CA Inland 1.15)

  因子: 1.25 / 1.15 \= 1.087x

  結果: $240 × 1.087 \= $261/SF

Step 3: 規模調整 (50,000 SF vs 35,062 SF)

  規模比例: 1.426

  因子: 1.0 \- (1.426 \- 1.0) × 0.02 \= 0.991x

  結果: $261 × 0.991 \= $259/SF

Step 4: 工期調整 (18 個月 vs 20 個月)

  工期差異: \-2 個月

  因子: 1.0 \+ (-2 × 0.01) \= 0.98x

  結果: $259 × 0.98 \= $254/SF

Step 5: 改造強度調整 (Level 2 vs Level 1\)

  因子: 1.35x

  結果: $254 × 1.35 \= $343/SF

Step 6: 複雜度調整 (Score 11 vs Score 9\)

  複雜度差異: \+2 分

  因子: 1.0 \+ (2 × 0.05) \= 1.10x

  結果: $343 × 1.10 \= $377/SF

最終調整後成本/SF: $377

### 淨調整因子計算

淨調整因子 \= 0.95 × 1.087 × 0.991 × 0.98 × 1.35 × 1.10

           \= 1.490x

驗證: $253 × 1.490 \= $377/SF ✓

---

## 驗證和檢查

### 調整因子驗證清單

在應用調整因子後，請驗證以下內容：

- [ ] 所有 6 個調整因子都已應用  
- [ ] 調整因子按正確順序應用  
- [ ] 每個調整因子在合理範圍內 (0.5x \- 2.0x)  
- [ ] 淨調整因子在合理範圍內 (0.5x \- 3.0x)  
- [ ] 最終調整後成本/SF 在合理範圍內  
- [ ] 調整後成本與參考案例的差異可以解釋

### 合理性檢查

**淨調整因子範圍**:

| 淨調整因子 | 評估 | 建議 |
| :---- | :---- | :---- |
| \< 0.5x | 🚨 異常低 | 檢查是否有錯誤 |
| 0.5x \- 1.0x | ✅ 合理 | 新項目成本更低 |
| 1.0x \- 1.5x | ✅ 合理 | 新項目成本略高 |
| 1.5x \- 2.0x | ⚠️ 中等 | 新項目成本明顯更高 |
| 2.0x \- 3.0x | ⚠️ 高 | 新項目成本大幅更高 |
| \> 3.0x | 🚨 異常高 | 檢查是否有錯誤 |

### 調整因子合理性檢查

**建築類型調整**:

- Healthcare → Healthcare: 0.90x \- 1.10x ✓  
- Healthcare → Warehouse: 0.60x \- 0.80x ✓  
- Healthcare → Commercial: 0.70x \- 0.90x ✓

**地區調整**:

- 相同地區: 0.95x \- 1.05x ✓  
- 相鄰地區: 0.85x \- 1.15x ✓  
- 不同地區: 0.70x \- 1.30x ✓

**規模調整**:

- 規模比例 0.5-2.0: 0.90x \- 1.10x ✓  
- 規模比例 0.3-3.0: 0.80x \- 1.20x ✓

**工期調整**:

- 工期差異 ±12 個月: 0.88x \- 1.12x ✓  
- 工期差異 ±24 個月: 0.76x \- 1.24x ✓

**改造強度調整**:

- 相鄰等級 (±1): 0.75x \- 1.35x ✓  
- 相差 2 等級 (±2): 0.60x \- 1.70x ✓

**複雜度調整**:

- 複雜度差異 ±4 分: 0.80x \- 1.20x ✓  
- 複雜度差異 ±8 分: 0.60x \- 1.40x ✓

---

**END OF LAYER 3.3: CASE ADJUSTMENT FACTORS v1.0 (PRODUCTION)**  
