# LAYER 3.1: CASE FEATURE EXTRACTION v1.0 (PRODUCTION)

**版本**: 1.0  
**狀態**: PRODUCTION  
**最後更新**: 2026-02-06  
**用途**: 定義如何從完成的建築項目中提取 6 類關鍵特性，用於案例庫和相似度匹配

---

## 目錄

1. [簡介](#簡介)  
2. [6 類特性定義](#6-類特性定義)  
3. [特性提取流程](#特性提取流程)  
4. [Colton Hospital II 案例](#colton-hospital-ii-案例)  
5. [Advantech 案例](#advantech-案例)  
6. [特性提取模板](#特性提取模板)

---

## 簡介

### 目的

案例特性提取是 **LAYER 3: Case-Based Reasoning (CBR)** 系統的基礎。通過系統化地提取完成項目的關鍵特性，我們可以：

1. **建立案例庫** \- 存儲所有完成項目的結構化數據  
2. **進行相似度匹配** \- 與新項目進行比較  
3. **應用調整因子** \- 基於差異進行成本調整  
4. **持續改進** \- 隨著案例庫增長，準確度提升

### 核心原則

- ✅ **結構化**: 所有特性都有明確的定義和單位  
- ✅ **可量化**: 特性可以進行數值比較  
- ✅ **可驗證**: 特性可以從項目文件中驗證  
- ✅ **可擴展**: 可以添加新的特性類別

---

## 6 類特性定義

### A. 基本特性 (Basic Characteristics)

**定義**: 項目的基本信息，用於初步識別和分類

| 特性 | 單位 | 範圍 | 說明 |
| :---- | :---- | :---- | :---- |
| **Project Name** | 文本 | N/A | 項目名稱 (唯一標識符) |
| **Project Type** | 分類 | Healthcare / Warehouse / Commercial / Other | 主要建築類型 |
| **Facility Type** | 分類 | 見下表 | 設施類型 (更詳細) |
| **Location \- State** | 文本 | CA, NY, TX, etc. | 項目所在州 |
| **Location \- City** | 文本 | N/A | 項目所在城市 |
| **Location \- County** | 文本 | N/A | 項目所在縣 |
| **Location \- ZIP** | 數字 | 5 位數 | 郵編 |
| **Building Area** | SF | 1,000 \- 1,000,000+ | 建築面積 |
| **Duration** | 月 | 6 \- 60+ | 施工工期 |
| **Completion Date** | 日期 | YYYY-MM-DD | 項目完成日期 |
| **GC Name** | 文本 | N/A | 總承包商名稱 |
| **GC Type** | 分類 | UPRITE / National / Regional / Local | GC 類型 |

**Healthcare 設施類型**:

- Behavioral Health Center  
- General Hospital  
- Medical Office Building (MOB)  
- Ambulatory Surgery Center (ASC)  
- Specialty Clinic

**Warehouse 設施類型**:

- Standard Warehouse  
- High-Bay Warehouse  
- Climate-Controlled Warehouse  
- Specialized Warehouse

---

### B. 成本特性 (Cost Characteristics)

**定義**: 項目的最終成本結構，用於成本模型驗證

| 特性 | 單位 | 範圍 | 說明 |
| :---- | :---- | :---- | :---- |
| **Final Cost** | $ | 1M \- 500M+ | 最終合約成本 (包含所有變更單) |
| **Cost per SF** | $/SF | 50 \- 2,000 | 單位面積成本 |
| **Direct Cost** | $ | 見下表 | 直接成本 (勞工 \+ 材料 \+ 設備 \+ 分包) |
| **Direct Cost %** | % | 40 \- 70 | 直接成本佔比 |
| **Indirect Cost** | $ | 見下表 | 間接成本 (管理 \+ 一般條件) |
| **Indirect Cost %** | % | 15 \- 40 | 間接成本佔比 |
| **Soft Cost** | $ | 見下表 | 軟成本 (設計 \+ 許可 \+ PM) |
| **Soft Cost %** | % | 8 \- 25 | 軟成本佔比 |
| **Profit/Fee** | $ | 見下表 | 利潤/費用 |
| **Profit/Fee %** | % | 4 \- 12 | 利潤/費用佔比 |
| **Contingency** | $ | 見下表 | 應急預留 |
| **Contingency %** | % | 5 \- 20 | 應急預留佔比 |
| **Change Orders** | $ | 0 \- 50M+ | 變更單總額 |
| **Change Order %** | % | 0 \- 15 | 變更單佔比 (相對於原合約) |

**成本驗證公式**:

Final Cost \= Direct Cost \+ Indirect Cost \+ Soft Cost \+ Profit/Fee \+ Contingency

Direct Cost % \+ Indirect Cost % \+ Soft Cost % \+ Profit/Fee % \+ Contingency % ≈ 100%

---

### C. 改造特性 (Renovation Characteristics)

**定義**: 項目的改造強度和系統重用情況，用於改造成本模型

| 特性 | 單位 | 範圍 | 說明 |
| :---- | :---- | :---- | :---- |
| **Project Type** | 分類 | New Construction / Renovation / Adaptive Reuse | 項目類型 |
| **Renovation Level** | 等級 | 1 \- 4 | 改造強度等級 (1=最小, 4=完全重建) |
| **MEP Reuse Factor** | % | 0 \- 100 | MEP 系統重用比例 |
| **Structure Reuse Factor** | % | 0 \- 100 | 結構系統重用比例 |
| **Envelope Reuse Factor** | % | 0 \- 100 | 建築外殼重用比例 |
| **Existing Building Age** | 年 | 0 \- 100+ | 現有建築年齡 |
| **Existing Building Condition** | 分類 | Good / Fair / Poor / Very Poor | 現有建築狀況 |
| **Phased Occupancy** | 是/否 | Yes / No | 施工期間是否分階段佔用 |

**改造等級定義**:

- **Level 1**: 化妝改造 (內部裝修、表面更新)  
- **Level 2**: 中等改造 (50% MEP 更換、部分結構加固)  
- **Level 3**: 主要改造 (70% MEP 更換、廣泛結構工作)  
- **Level 4**: 完全重建 (90%+ 更換、主要重建)

---

### D. 地區特性 (Regional Characteristics)

**定義**: 項目所在地區的成本影響因素，用於地區調整

| 特性 | 單位 | 範圍 | 說明 |
| :---- | :---- | :---- | :---- |
| **Regional Multiplier** | 倍數 | 0.80 \- 1.50 | 地區成本乘數 (相對於全國平均) |
| **State Code Premium** | % | 0 \- 30 | 州級建築法規溢價 (如 OSHPD, CBC) |
| **Local Code Premium** | % | 0 \- 20 | 地方建築法規溢價 |
| **Seismic Zone** | 分類 | Low / Medium / High / Very High | 地震風險等級 |
| **Geotechnical Risk** | % | 0 \- 20 | 地質風險調整 (液化、地基等) |
| **Environmental Risk** | % | 0 \- 15 | 環保風險調整 (污染整治等) |
| **Labor Availability** | 分類 | High / Medium / Low | 勞工可用性 |
| **Prevailing Wage** | 是/否 | Yes / No | 是否適用最低工資要求 |
| **Prevailing Wage Multiplier** | 倍數 | 1.00 \- 1.35 | 最低工資乘數 |

**Regional Multiplier 範例**:

- CA Coastal (San Francisco, LA): 1.20 \- 1.30  
- CA Inland (Inland Empire): 1.10 \- 1.15  
- TX (Houston, Dallas): 0.95 \- 1.05  
- NY (NYC): 1.25 \- 1.35  
- National Average: 1.00

---

### E. 系統特性 (System Characteristics)

**定義**: 項目的專業系統複雜度和特殊要求，用於系統溢價計算

| 特性 | 單位 | 範圍 | 說明 |
| :---- | :---- | :---- | :---- |
| **MEP Complexity** | 分類 | Low / Medium / High / Very High | MEP 系統複雜度 |
| **HVAC System Type** | 分類 | Standard / VRF / Chilled Water / Other | HVAC 系統類型 |
| **Electrical Load** | A | 100 \- 5,000+ | 電氣負荷 |
| **Backup Power** | 是/否 | Yes / No | 是否需要備用發電 |
| **Medical Gas Systems** | 是/否 | Yes / No | 是否需要醫療氣體系統 |
| **Fire Protection Type** | 分類 | Wet / Dry / Pre-action / ESFR | 防火系統類型 |
| **Specialized Equipment** | 文本 | MRI / CT / LINAC / Solar / Other | 特殊設備 |
| **System Premium** | % | 0 \- 20 | 專業系統溢價 |
| **Sustainability Features** | 文本 | LEED / Net-Zero / Solar / EV Charging | 可持續性特性 |

**MEP 複雜度定義**:

- **Low**: 標準 HVAC、標準電氣、標準給排水  
- **Medium**: VRF HVAC、升級電氣、醫療氣體系統  
- **High**: 複雜 HVAC、高負荷電氣、多個專業系統  
- **Very High**: 多個複雜系統、特殊設備、集成控制

**特殊條件開關 (Specialized Condition Switches)**

| 特性 | 開關代碼 | 說明 |
| :---- | :---- | :---- |
| **地質改良溢價** | \[Geo\_Improvement\] | 參考 Advantech 案例：適用於 High Seismic / Liquefaction 區域，經確認後需要優化地基，增加地基成本 20%。 |
| **醫療合規溢價** | \[HCAI\_Compliance\] | 參考 Colton II 案例：適用於加州醫療設施，經確認後，MEP 人工成本增加 20-30% |
| **防綁紮五金溢價** | \[Anti\_Ligature\] | 參考 Colton II 案例：適用於 Behavioral Health，門窗五金單價為標準 3x |
| **高淨空結構乘數** | \[High\_Bay\_32\] | 參考 Advantech AASC：若是  Clear height \>32ft，鋼構 Div 05 成本增加 15% |

---

### F. 風險特性 (Risk Characteristics)

**定義**: 項目的複雜度和風險因素，用於風險評估和應急預留

| 特性 | 單位 | 範圍 | 說明 |
| :---- | :---- | :---- | :---- |
| **Complexity Score** | 分 | 8 \- 16 | 項目複雜度評分 (8=簡單, 16=複雜) |
| **Complexity Multiplier** | 倍數 | 1.2 \- 2.0 | 複雜度乘數 |
| **Design Completeness** | % | 0 \- 100 | 設計完成度 |
| **Change Order Risk** | % | 0 \- 15 | 變更單風險 |
| **Schedule Risk** | % | 0 \- 10 | 工期延誤風險 |
| **Material Cost Risk** | % | 0 \- 10 | 材料成本超支風險 |
| **Labor Cost Risk** | % | 0 \- 10 | 勞工成本超支風險 |
| **Overall Risk Score** | 分 | 0 \- 100 | 整體風險評分 |
| **Risk Level** | 分類 | Low / Medium / High / Very High | 風險等級 |
| **Change Order Risk** | % | 0 \- 10 | 參考 Colton II 的變更預算 |

**複雜度評分計算**:  
Complexity Score \=   
  \+ Building Type (1-4)  
  \+ MEP Complexity (1-4)  
  \+ Structural Complexity (1-4)  
  \+ Regulatory Complexity (1-4)  
  \+ Mixed-use (+2)  
  \+ Healthcare (+3)  
  

Score 8-10: Low Complexity (1.2x multiplier)  
Score 11-13: Medium Complexity (1.5x multiplier)  
Score 14-15: High Complexity (1.8x multiplier)  
Score 16: Very High Complexity (2.0x multiplier)

---

## 特性提取流程

### Step 1: 收集項目文件

**必需文件**:

- [ ] Basis of Design (BOD)  
- [ ] Final Contract  
- [ ] Change Order Log  
- [ ] Cost Breakdown (CSI Divisions)  
- [ ] Project Schedule  
- [ ] Site Plans / Floor Plans

**可選文件**:

- [ ] Lessons Learned Report  
- [ ] Risk Register  
- [ ] Project Management Report

---

### Step 2: 提取基本特性

**操作**:

1. 從 BOD 和合約中提取項目名稱、類型、位置  
2. 計算建築面積 (從平面圖)  
3. 計算工期 (從進度表)  
4. 確認 GC 名稱和類型

**驗證**:

- [ ] 項目名稱唯一  
- [ ] 位置信息完整 (州、市、縣、ZIP)  
- [ ] 建築面積合理  
- [ ] 工期合理 (6-60 個月)

---

### Step 3: 提取成本特性

**操作**:

1. 從最終合約提取總成本  
2. 計算成本/SF (總成本 ÷ 建築面積)  
3. 從成本分解表提取各成本分類  
4. 計算各成本分類的百分比  
5. 從變更單日誌提取變更單信息

**驗證**:

- [ ] 所有成本分類之和 \= 100%  
- [ ] 成本/SF 在合理範圍內  
- [ ] 變更單信息準確

**成本分類驗證公式**:

Direct Cost % \+ Indirect Cost % \+ Soft Cost % \+ Profit/Fee % \+ Contingency % \= 100%

示例:

50% \+ 21% \+ 17% \+ 6% \+ 6% \= 100% ✓

---

### Step 4: 提取改造特性

**操作**:

1. 確定項目類型 (新建 / 改造 / 自適應重用)  
2. 根據 MEP 更換比例確定改造等級  
3. 估計各系統的重用因子  
4. 確認現有建築信息

**改造等級判斷**:

MEP 更換比例 \< 30% → Level 1 (化妝改造)

MEP 更換比例 30-50% → Level 2 (中等改造)

MEP 更換比例 50-80% → Level 3 (主要改造)

MEP 更換比例 \> 80% → Level 4 (完全重建)

---

### Step 5: 提取地區特性

**操作**:

1. 從地區數據庫查詢地區乘數  
2. 確定適用的建築法規 (OSHPD, CBC, etc.)  
3. 評估地震、地質、環保風險  
4. 確認勞工情況 (最低工資等)

**地區乘數查詢**:

- 使用 LAYER 2 地區調整因子表  
- 基於州、市、縣進行查詢  
- 確認最新的乘數版本

---

### Step 6: 提取系統特性

**操作**:

1. 從 BOD 確定 MEP 系統類型  
2. 識別特殊系統 (醫療氣體、防火等)  
3. 評估系統複雜度  
4. 計算系統溢價

**系統溢價計算**:

System Premium \= Base Premium \+ Specialized Systems Premium

示例 (Healthcare):

Base Premium: 5%

Medical Gas Systems: \+3%

Fire Protection: \+2%

Total: 10%

---

### Step 7: 提取風險特性

**操作**:

1. 計算複雜度評分 (8-16 分)  
2. 評估各項風險 (變更單、工期、成本)  
3. 計算整體風險評分  
4. 確定風險等級

**複雜度評分計算**:

Building Type Score:

  \- Healthcare: 3-4

  \- Warehouse: 2-3

  \- Commercial: 2-3

MEP Complexity Score:

  \- Low: 1

  \- Medium: 2

  \- High: 3

  \- Very High: 4

Structural Complexity Score:

  \- Minimal: 1

  \- Partial: 2

  \- Significant: 3

  \- Major: 4

Regulatory Complexity Score:

  \- Standard: 1

  \- OSHPD 3: 2

  \- OSHPD 1: 3

  \- Multiple Jurisdictions: 4

Total Score \= Sum of all scores

---

## Colton Hospital II 案例

### 基本特性

Project\_Name: "Colton Hospital II \- Behavioral Health Center"

Project\_Type: "Healthcare"

Facility\_Type: "Behavioral Health Center"

Location:

  State: "CA"

  City: "Colton"

  County: "San Bernardino"

  ZIP: "92324"

Building\_Area: 35062  \# SF

Duration: 20  \# months

Completion\_Date: "2025-12-31"

GC\_Name: "UPRITE Construction Corp"

GC\_Type: "UPRITE"

### 成本特性

Final\_Cost: 8862724  \# $

Cost\_Per\_SF: 253  \# $/SF

Direct\_Cost: 4365219  \# $

Direct\_Cost\_Percent: 50.0  \# %

Indirect\_Cost: 1859623  \# $

Indirect\_Cost\_Percent: 21.3  \# %

Soft\_Cost: 1484375  \# $

Soft\_Cost\_Percent: 17.0  \# %

Profit\_Fee: 523826  \# $

Profit\_Fee\_Percent: 6.0  \# %

Contingency: 897395  \# $

Contingency\_Percent: 10.3  \# %

Change\_Orders: 726175  \# $ (from actual project)

Change\_Order\_Percent: 8.2  \# %

### 改造特性

Project\_Type: "Adaptive Reuse / Renovation"

Renovation\_Level: 1  \# Cosmetic (70-80% MEP reuse)

MEP\_Reuse\_Factor: 0.75  \# 75%

Structure\_Reuse\_Factor: 0.90  \# 90%

Envelope\_Reuse\_Factor: 0.85  \# 85%

Existing\_Building\_Age: 15  \# years

Existing\_Building\_Condition: "Fair"

Phased\_Occupancy: "No"  \# Complete closure during construction

### 地區特性

Regional\_Multiplier: 1.15  \# Inland Empire

State\_Code\_Premium: 0.12  \# OSHPD 3 (+12%)

Local\_Code\_Premium: 0.05  \# Local codes

Seismic\_Zone: "High"

Geotechnical\_Risk: 0.05  \# Liquefaction risk (+5%)

Environmental\_Risk: 0.01  \# Minor contamination (+1%)

Labor\_Availability: "Medium"

Prevailing\_Wage: "No"

Prevailing\_Wage\_Multiplier: 1.00

### 系統特性

MEP\_Complexity: "Medium"

HVAC\_System\_Type: "Rooftop DX Units \+ VAV"

Electrical\_Load: 1500  \# Amps

Backup\_Power: "Yes"  \# Generator required

Medical\_Gas\_Systems: "Yes"  \# O2, Medical Air, Vacuum

Fire\_Protection\_Type: "Wet Sprinkler \+ Pre-action"

Specialized\_Equipment: "None"

System\_Premium: 0.03  \# 3%

Sustainability\_Features: "Standard"

### 風險特性

Complexity\_Score: 9  \# Medium

Complexity\_Multiplier: 1.2

Design\_Completeness: 0.95  \# 95%

Change\_Order\_Risk: 0.05  \# 5%

Schedule\_Risk: 0.03  \# 3%

Material\_Cost\_Risk: 0.02  \# 2%

Labor\_Cost\_Risk: 0.02  \# 2%

Overall\_Risk\_Score: 35  \# Low-Medium

Risk\_Level: "Medium"

---

## Advantech 案例

### 基本特性

Project\_Name: "Advantech North America Campus"

Project\_Type: "Commercial"

Facility\_Type: "Mixed Use (HQ \+ Warehouse)"

Location:

  State: "CA"

  City: "Tustin"

  County: "Orange"

  ZIP: "92780"

Building\_Area: 450000  \# SF (estimated)

Duration: 21  \# months

Completion\_Date: "2025-09-30"

GC\_Name: "Unknown"

GC\_Type: "National"

### 成本特性

Final\_Cost: 75483200  \# $

Cost\_Per\_SF: 168  \# $/SF (estimated)

Direct\_Cost: 37741600  \# $ (50% estimated)

Direct\_Cost\_Percent: 50.0  \# %

Indirect\_Cost: 15966672  \# $ (21.2% estimated)

Indirect\_Cost\_Percent: 21.2  \# %

Soft\_Cost: 12837344  \# $ (17% estimated)

Soft\_Cost\_Percent: 17.0  \# %

Profit\_Fee: 4524992  \# $ (6% estimated)

Profit\_Fee\_Percent: 6.0  \# %

Contingency: 4412592  \# $ (5.8% estimated)

Contingency\_Percent: 5.8  \# %

Change\_Orders: 4283200  \# $ (from lessons learned)

Change\_Order\_Percent: 6.0  \# %

### 改造特性

Project\_Type: "New Construction"

Renovation\_Level: 0  \# N/A

MEP\_Reuse\_Factor: 0.00  \# N/A

Structure\_Reuse\_Factor: 0.00  \# N/A

Envelope\_Reuse\_Factor: 0.00  \# N/A

Existing\_Building\_Age: 0  \# N/A

Existing\_Building\_Condition: "N/A"

Phased\_Occupancy: "No"

### 地區特性

Regional\_Multiplier: 1.20  \# Orange County, CA

State\_Code\_Premium: 0.08  \# California standards

Local\_Code\_Premium: 0.03  \# Local codes

Seismic\_Zone: "Medium"

Geotechnical\_Risk: 0.02  \# Low risk

Environmental\_Risk: 0.00  \# No risk

Labor\_Availability: "Low"

Prevailing\_Wage: "Yes"  \# Likely, given project size

Prevailing\_Wage\_Multiplier: 1.30  \# \+30% labor cost

### 系統特性

MEP\_Complexity: "High"

HVAC\_System\_Type: "VRF \+ Chilled Water"

Electrical\_Load: 3000  \# Amps

Backup\_Power: "Yes"

Medical\_Gas\_Systems: "No"

Fire\_Protection\_Type: "ESFR K25.2 Sprinkler"

Specialized\_Equipment: "Solar (360 KW), EV Charging"

System\_Premium: 0.08  \# 8%

Sustainability\_Features: "Solar, EV Charging, High-Performance Envelope"

### 風險特性

Complexity\_Score: 14  \# High

Complexity\_Multiplier: 1.8

Design\_Completeness: 0.90  \# 90%

Change\_Order\_Risk: 0.08  \# 8%

Schedule\_Risk: 0.05  \# 5%

Material\_Cost\_Risk: 0.05  \# 5%

Labor\_Cost\_Risk: 0.04  \# 4%

Overall\_Risk\_Score: 65  \# Medium-High

Risk\_Level: "High"

---

## 特性提取模板

### YAML 格式模板

Case\_ID: "CASE\_XXX"

Project\_Name: "\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_"

Extraction\_Date: "YYYY-MM-DD"

Extracted\_By: "\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_"

\# A. BASIC CHARACTERISTICS

Basic\_Characteristics:

  Project\_Name: "\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_"

  Project\_Type: "Healthcare / Warehouse / Commercial / Other"

  Facility\_Type: "\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_"

  Location:

    State: "\_\_\_"

    City: "\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_"

    County: "\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_"

    ZIP: "\_\_\_\_\_ "

  Building\_Area: \_\_\_\_\_ \# SF

  Duration: \_\_\_\_\_ \# months

  Completion\_Date: "YYYY-MM-DD"

  GC\_Name: "\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_"

  GC\_Type: "UPRITE / National / Regional / Local"

\# B. COST CHARACTERISTICS

Cost\_Characteristics:

  Final\_Cost: \_\_\_\_\_\_\_ \# $

  Cost\_Per\_SF: \_\_\_\_\_\_ \# $/SF

  Direct\_Cost: \_\_\_\_\_\_\_ \# $

  Direct\_Cost\_Percent: \_\_\_\_ \# %

  Indirect\_Cost: \_\_\_\_\_\_\_ \# $

  Indirect\_Cost\_Percent: \_\_\_\_ \# %

  Soft\_Cost: \_\_\_\_\_\_\_ \# $

  Soft\_Cost\_Percent: \_\_\_\_ \# %

  Profit\_Fee: \_\_\_\_\_\_\_ \# $

  Profit\_Fee\_Percent: \_\_\_\_ \# %

  Contingency: \_\_\_\_\_\_\_ \# $

  Contingency\_Percent: \_\_\_\_ \# %

  Change\_Orders: \_\_\_\_\_\_\_ \# $

  Change\_Order\_Percent: \_\_\_\_ \# %

\# C. RENOVATION CHARACTERISTICS

Renovation\_Characteristics:

  Project\_Type: "New Construction / Renovation / Adaptive Reuse"

  Renovation\_Level: \_ \# 1-4 (if renovation)

  MEP\_Reuse\_Factor: \_\_\_\_ \# %

  Structure\_Reuse\_Factor: \_\_\_\_ \# %

  Envelope\_Reuse\_Factor: \_\_\_\_ \# %

  Existing\_Building\_Age: \_\_\_\_ \# years

  Existing\_Building\_Condition: "Good / Fair / Poor / Very Poor"

  Phased\_Occupancy: "Yes / No"

\# D. REGIONAL CHARACTERISTICS

Regional\_Characteristics:

  Regional\_Multiplier: \_\_\_\_ \# 0.80-1.50

  State\_Code\_Premium: \_\_\_\_ \# %

  Local\_Code\_Premium: \_\_\_\_ \# %

  Seismic\_Zone: "Low / Medium / High / Very High"

  Geotechnical\_Risk: \_\_\_\_ \# %

  Environmental\_Risk: \_\_\_\_ \# %

  Labor\_Availability: "High / Medium / Low"

  Prevailing\_Wage: "Yes / No"

  Prevailing\_Wage\_Multiplier: \_\_\_\_ \# 1.00-1.35

\# E. SYSTEM CHARACTERISTICS

System\_Characteristics:

  MEP\_Complexity: "Low / Medium / High / Very High"

  HVAC\_System\_Type: "\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_"

  Electrical\_Load: \_\_\_\_\_ \# Amps

  Backup\_Power: "Yes / No"

  Medical\_Gas\_Systems: "Yes / No"

  Fire\_Protection\_Type: "\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_"

  Specialized\_Equipment: "\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_"

  System\_Premium: \_\_\_\_ \# %

  Sustainability\_Features: "\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_"

\# F. RISK CHARACTERISTICS

Risk\_Characteristics:

  Complexity\_Score: \_\_\_\_ \# 8-16

  Complexity\_Multiplier: \_\_\_\_ \# 1.2-2.0

  Design\_Completeness: \_\_\_\_ \# %

  Change\_Order\_Risk: \_\_\_\_ \# %

  Schedule\_Risk: \_\_\_\_ \# %

  Material\_Cost\_Risk: \_\_\_\_ \# %

  Labor\_Cost\_Risk: \_\_\_\_ \# %

  Overall\_Risk\_Score: \_\_\_\_ \# 0-100

  Risk\_Level: "Low / Medium / High / Very High"

\# LESSONS LEARNED

Lessons\_Learned:

  \- "\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_"

  \- "\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_"

  \- "\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_"

\# NOTES

Notes: "\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_"

---

## 驗證清單

在提取特性後，請驗證以下內容：

### 成本驗證

- [ ] Direct Cost % \+ Indirect Cost % \+ Soft Cost % \+ Profit/Fee % \+ Contingency % ≈ 100%  
- [ ] Final Cost \= Direct Cost \+ Indirect Cost \+ Soft Cost \+ Profit/Fee \+ Contingency  
- [ ] Cost per SF \= Final Cost ÷ Building Area  
- [ ] 所有百分比在合理範圍內

### 改造驗證

- [ ] 如果是改造項目，MEP 重用因子在 0-100% 之間  
- [ ] 改造等級與 MEP 重用因子一致  
- [ ] 現有建築信息完整

### 地區驗證

- [ ] 地區乘數在 0.80-1.50 之間  
- [ ] 法規溢價在 0-30% 之間  
- [ ] 地震、地質、環保風險合理

### 系統驗證

- [ ] MEP 複雜度與系統溢價一致  
- [ ] 特殊設備信息完整  
- [ ] 系統溢價在 0-20% 之間

### 風險驗證

- [ ] 複雜度評分在 8-16 之間  
- [ ] 複雜度乘數在 1.2-2.0 之間  
- [ ] 整體風險評分在 0-100 之間  
- [ ] 風險等級與複雜度評分一致

---

**END OF LAYER 3.1: CASE FEATURE EXTRACTION v1.0 (PRODUCTION)**  
