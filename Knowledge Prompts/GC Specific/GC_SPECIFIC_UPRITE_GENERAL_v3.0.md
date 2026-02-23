# GC_SPECIFIC: UPRITE CONSTRUCTION CORP v3.0 (HARD/SOFT MODEL)

**Version**: 3.0
**Status**: PRODUCTION
**Last Updated**: 2026-02-19
**Applicability**: All UPRITE projects (Healthcare, Warehouse, Commercial)
**Source Truth**: Based on Colton Hospital II G702/G703 Application #12 & Advantech Lessons Learned

---

## 1. UPRITE COST STRUCTURE (REVISED)

UPRITE follows the standard **Hard Cost / Soft Cost** model, with specific definitions for General Conditions and Fee.

### 1.1. Hard Costs (Construction Budget)

Hard Costs represent the direct cost of the work, including site management.

| Cost Component | Definition | Includes | Calculation Method |
| :--- | :--- | :--- | :--- |
| **A. General Conditions (Div 01)** | **Site Management** | - Superintendent, PE, PM (Site allocation)<br>- Temp Utilities, Trailer, Toilets<br>- Safety, Cleanup, Dumpsters | **Monthly Burn Rate**<br>`Rate × Duration (Months)` |
| **B. Trade Costs (Div 02-33)** | **Subcontractors** | - All trade subcontracts<br>- Materials & Equipment<br>- Labor | **Bottom-Up**<br>(Quantities × Unit Rates) |
| **C. Insurance & Bonds** | **Project Insurance** | - GL / PL / Builder's Risk<br>- Payment & Performance Bonds | **Percentage of (A+B)**<br>Typically 1.5% - 2.0% |

### 1.2. Soft Costs (Fee & Contingency)

Soft Costs represent the contractor's markup and risk reserves.

| Cost Component | Definition | Includes | Calculation Method |
| :--- | :--- | :--- | :--- |
| **D. Contractor Fee** | **OH & Profit** | - Home Office Overhead<br>- Executive Management<br>- Net Profit | **Percentage of Hard Costs**<br>Rate: 5.0% - 8.0% |
| **E. Contingency** | **Risk Reserve** | - Contract Contingency (GC controlled)<br>- Owner Contingency (Owner held) | **Percentage of (Hard + Fee)**<br>Rate: 3% - 10% |

---

## 2. CALCULATION FORMULAS

### 2.1. General Conditions (Div 01) Calculation

**Formula**: `Div 01 Cost = Monthly Burn Rate × Project Duration (Months)`

**Burn Rate Guidelines**:
- **Small Projects (<$5M)**: $35,000 / month
- **Medium Projects ($5M-$20M)**: $55,000 / month
- **Large Projects (>$20M)**: $80,000+ / month
- **High-Cost Region (e.g., Santa Clara)**: Add +20% to Burn Rate.

### 2.2. Contractor Fee Calculation

**Formula**: `Fee = Total Hard Costs × Fee_Rate`

**Fee Rate Guidelines**:
- **Standard Projects**: 5.0% - 6.0% (Competitive bid / GC already engaged)
- **Complex/High Risk**: 6.0% - 8.0%
- **Small Projects (<$2M)**: 8.0% - 10.0%
- **Owner Budget Estimate (no GC confirmed)**: 8.0%
- **Small project <$2M competitive bid**: 6.0%

=== UPRITE FEE RATE SELECTION LOGIC (UPDATED) ===
  Owner budget estimate (no GC confirmed): 8.0%
  Competitive bid / GC already engaged: 5.0%
  Small project <$2M competitive bid: 6.0%
  ⚠️ ALWAYS ask: "Is this estimate for owner budgeting or GC bid review?"
  Source: Wang Medical Office Building actual fee = 5.0% ($142,857 on $2,416,801 trade)

=== UPRITE CONTINGENCY + INSURANCE (ACTUAL RATES) ===
  Contingency: 4.34% of subtotal (NOT 10–15%)
  Insurance (GL): 1.20% of subtotal
  NOTE: These apply when design is complete (CDs issued)
  Use 10–15% contingency only for conceptual/schematic designs

=== UPRITE STANDARD EXCLUSIONS (FL SHELL BUILDING) ===
  From Wang MOB actual contract — always cross-reference:
  #41: Slab on Grade + Vapor Barrier
  #46: Roof-top HVAC units, controls, power, condensate
  #25: Overtime + Prevailing Wage (FL private)
  #39: Low voltage systems (data, phone, AV, access control)
  #35: Emergency generators
  #44: Fire pump
  #3:  Payment & Performance Bonds
  #6:  Tariff cost increases
  #10: Owner's Contingency

=== UPRITE ACTUAL BURN RATES (VERIFIED) ===
  FL Shell Building <$5M: $41,290/month
  Source: Wang MOB Bradenton FL 2025, 7-month duration, $289,030 GC total

=== UPRITE STRUCTURAL SYSTEM DETECTION ===
  When reading structural drawings, identify system type:
  CMU Bearing Wall → continuous footings (25–50 CY / 10,000 SF)
  Steel Frame → independent column footings (600–1,000 CY / 10,000 SF)
  Tilt-up → grade beam + slab thickening
  Mixed → ask structural engineer or GC

---

## 3. OUTPUT FORMAT: AIA G703 MAPPING

The final output table must map costs to the AIA G703 format, treating Div 01 as part of the "Cost of Work".

| Item No. | Description of Work | Mapping Logic |
| :--- | :--- | :--- |
| 1 | **Div 01 - General Conditions** | **Hard Cost** (Site Staff & Facilities) |
| 2-15 | **Div 02 - 33 (Trades)** | **Hard Cost** (Subcontractors) |
| 16 | **Insurance/Bond** | **Hard Cost** (Project Specific) |
| **SUBTOTAL** | **TOTAL HARD COSTS** | **Sum of 1-16** |
| 17 | **Contractor Fee** | **Soft Cost** (OH&P) |
| 18 | **Contingency** | **Soft Cost** (Risk Reserve) |
| **TOTAL** | **TOTAL CONTRACT SUM** | **Hard Costs + Soft Costs** |

---

## 4. UPRITE COST MODEL EXAMPLE: ADVANTECH PROJECT (REVISED)

This section provides a complete example of the UPRITE cost model applied to the Advantech North America Campus project using the **Hard/Soft** structure.

### 4.1. Cost Calculation Summary

| Cost Component | Amount | % of Total | Notes |
| :--- | :--- | :--- | :--- |
| **A. General Conditions (Div 01)** | $10,869,581 | 8.4% | 24 Months @ ~$450k/mo (Large Complex) |
| **B. Trade Costs (Div 02-33)** | $89,767,499 | 69.1% | All Subcontractors |
| **C. Insurance (1.5%)** | $1,509,556 | 1.2% | GL/PL/Builder's Risk |
| **TOTAL HARD COSTS** | **$102,146,636** | **78.6%** | **Base Construction Cost** |
| | | | |
| **D. Contractor Fee (6%)** | $6,128,798 | 4.7% | OH&P on Hard Costs |
| **E. Contingency (Owner+GC)** | $21,706,636 | 16.7% | High Risk (Utilities/Tariffs) |
| **TOTAL SOFT COSTS** | **$27,835,434** | **21.4%** | **Fee + Reserves** |
| | | | |
| **TOTAL PROJECT COST** | **$129,982,070** | **100.0%** | **Final Budget** |

### 4.2. AIA G703 Format Output

| Item | Description | Amount |
| :--- | :--- | :--- |
| 1 | Div 01 - General Conditions | $10,869,581 |
| 2 | Div 03 - Concrete | $13,586,976 |
| 3 | Div 05 - Metals | $16,606,304 |
| 4 | Div 07 - Thermal & Moisture | $4,528,992 |
| 5 | Div 08 - Openings | $3,019,328 |
| 6 | Div 09 - Finishes | $2,264,496 |
| 7 | Div 21 - Fire Suppression | $2,264,496 |
| 8 | Div 22 - Plumbing | $1,509,664 |
| 9 | Div 23 - HVAC | $3,774,160 |
| 10 | Div 26 - Electrical | $6,038,656 |
| 11 | Div 27 - Communications | $754,832 |
| 12 | Div 31 - Earthwork | $3,774,160 |
| 13 | Div 32 - Exterior Improvements | $3,019,328 |
| 14 | Div 33 - Utilities | $1,509,664 |
| 15 | Other Trades | $2,264,496 |
| 16 | Insurance & Bonds | $1,509,556 |
| **SUB** | **TOTAL HARD COSTS** | **$102,146,636** |
| 17 | Contractor Fee (6%) | $6,128,798 |
| 18 | Contingency | $21,706,636 |
| **TOT** | **TOTAL CONTRACT SUM** | **$129,982,070** |

---

## 5. VALIDATION CHECKLIST

Before finalizing UPRITE estimates, verify:

- [ ] **Div 01 Calculation**: Is Burn Rate appropriate for project size/location?
- [ ] **Hard Cost Completeness**: Are all trades and insurance included?
- [ ] **Fee Application**: Is Fee applied to the total Hard Cost?
- [ ] **Contingency**: Is the contingency % aligned with risk level?
- [ ] **Format**: Does the output match the AIA G703 structure above?

---

**END OF UPRITE CONSTRUCTION CORP v3.0 (HARD/SOFT MODEL)**
