_# LAYER 2: WAREHOUSE KNOWLEDGE PROMPT v1.2 (PRODUCTION)_

**Version**: 1.2
**Status**: PRODUCTION
**Last Updated**: 2026-02-07
**Improvements from v1.1**:
- Removed methodological sections (Complexity, Geotechnical, Specialized Systems) to eliminate redundancy with LAYER1.
- Retained core warehouse-specific data and parameters.

> ⚠️ **DATA VALIDITY WARNING**: 
> The base costs in this document are based on 2025 averages. 
> **RULE 12 APPLIES**: If the current date is > 3 months past the "Last Updated" date, the System MUST trigger a real-time search for updated Labor Rates and Material Indices.

---

## 1. BUILDING TYPE DEFINITION

**Warehouse** is defined as a single-story or multi-story, high-bay industrial building designed primarily for storage and distribution of goods. This knowledge prompt specifically addresses hybrid warehouse/office buildings common in California.

### 1.1. Key Characteristics

- **Occupancy Type**: Storage (IBC Group S-1 or S-2) with Office component
- **Typical Clear Height**: 28-40 feet (assume 32 feet if not provided)
- **Structural System**: Structural Steel or Pre-engineered Metal Building (PEMB)
- **Foundation**: Slab-on-grade with reinforced concrete or spread foundations with ground improvement
- **Roof**: Metal deck with single-ply membrane or built-up roofing
- **Walls**: Metal siding or tilt-up concrete
- **Office Area**: 5-15% of total building area (assume 10% if not provided)
- **Dock Doors**: Typically 4-8 (assume 6 if not provided)
- **Utilities**: Standard electrical, water, sewer; may include specialized MEP for office component

### 1.2. Sub-Type Definitions & Cost Adjustments

Warehouse sub-types are treated as **adjustments** to the base cost, not as separate base cost categories.

| Sub-Type | Description | Base Cost Adjustment |
|---|---|---|
| **Standard Warehouse** | General goods storage, basic systems. | +0% (Baseline) |
| **High-Bay Warehouse** | 32-40 ft clear height, potential for automated systems. | +$30-40/SF (Structural Steel) or 2.3-2.8x multiplier |
| **Cold Storage** | Insulated walls, industrial refrigeration systems for food/pharma. | +$80-120/SF |
| **Clean Warehouse** | ESD protection, cleanliness controls for electronics/manufacturing. | +$40-90/SF |
| **Hybrid Warehouse/Office** | Mixed-use with office component (15-30% of building). | +$50-100/SF (blended) |
| **⛔ High-Tech Manufacturing TI** | Photonics, electronics, semiconductor tenant improvements. NOT standard industrial TI. | Base $200-250/SF (see §1.3) |

### ⛔ 1.3. HIGH-TECH MANUFACTURING TI — CRITICAL CLASSIFICATION OVERRIDE

**RULE**: If project documents mention ANY of these keywords, this is NOT a standard industrial TI ($60-$120/SF). It is a **High-Tech Manufacturing TI** at **$200-$250/SF**:

**Detection Triggers** (any 2+ = HIGH-TECH MANUFACTURING TI):
- ESD flooring / static-dissipative floor
- N₂ (nitrogen) piping / CDA (clean dry air) / process gas
- T-GRID ceiling system / industrial grid ceiling
- 100+ workstations or production stations
- Photonics / optics / laser assembly
- Cleanroom or controlled environment
- Specialty exhaust / fume hood systems
- Anti-vibration isolation

#### Calibrated Unit Costs (from 決算 comparison — Texas 2025)

| Item | Standard Industrial TI | High-Tech Manufacturing TI | Notes |
|---|---|---|---|
| **T-GRID Ceiling** | ACT $7-8/SF | C1=$27/SF, C2=$18/SF | Ceiling area can be 2× GFA in multi-height spaces |
| **N₂ SS Piping** | N/A | $130-$454/LF by diameter | 3-5× standard gas pipe; valve count from workstation layout |
| **CDA Piping** | N/A | $80-$200/LF by diameter | Similar premium to N₂ |
| **Electrical** | $15-$20/SF | $45/SF | High outlet density, dedicated circuits per station |
| **ESD Flooring** | Standard VCT $5/SF | ESD epoxy $12-$18/SF | Full coverage required |
| **Fire Protection** | $4-$6/SF | $8-$12/SF | Gas suppression zones, higher density |
| **Structural (interior)** | Minimal | Ceiling joists $8-$12/SF | "No structural work" in TI = no shell mods, NOT no interior framing |

#### Critical Lessons Learned

1. **"No structural work" disambiguation**: In TI context, this means no modifications to the building shell/envelope. Interior structural framing (ceiling joists, mezzanine supports) is still required and can be $500K-$1M+.
2. **Ceiling area ≠ GFA**: In multi-height manufacturing spaces, T-GRID ceiling area can be 1.5-2× the floor GFA. Always verify ceiling SF separately.
3. **Process gas valve count**: Derive from workstation count × valves-per-station (typically 2-4 per station for N₂/CDA).
4. **Electrical density**: High-tech manufacturing = 1 outlet per 40 SF minimum (vs 1 per 120 SF standard office). Include dedicated 20A circuits.
5. **Standard TI benchmarks DO NOT APPLY**: Generic "industrial TI" at $60-$120/SF will produce 2-3× underestimates for high-tech manufacturing.
6. **Fire protection upgrade**: Process gases require enhanced fire protection — budget $8-$12/SF not $4-$6/SF.
7. **HVAC for manufacturing**: Precision temperature/humidity control adds $15-$25/SF over standard warehouse HVAC.
8. **Phasing premium**: If occupied adjacent spaces must remain operational, add 10-20% for phased construction logistics.
9. **Commissioning**: High-tech systems require extended commissioning — budget 2-3% of MEP cost (vs 1% standard).

---

## 2. BASE HARD COSTS (REVISED 2024-2026)

This section provides the foundational hard costs per square foot, categorized by building size and type. These costs represent the baseline before any regional, complexity, or risk-related adjustments are applied.

### 2.1. Base Costs by Building Size (National Average, 2025-2026)

| Building Size (SF) | Standard Warehouse | High-Bay Warehouse | Hybrid Warehouse/Office |
|---|---|---|---|
| 10,000 - 30,000 | $105/SF | $150-180/SF | $180-220/SF |
| 30,001 - 50,000 | $92/SF | $140-170/SF | $170-210/SF |
| 50,001 - 100,000 | $85/SF | $130-160/SF | $160-200/SF |
| 100,001 - 200,000 | $82/SF | $125-155/SF | $155-195/SF |
| 200,001 - 500,000 | $78/SF | $120-150/SF | $150-190/SF |
| 500,001+ | $75/SF | $115-145/SF | $145-185/SF |

**Note on Escalation**:
- **2024 to 2025**: +3.5% (already applied to the costs above).
- **2025 to 2026 (Projected)**: +2.5% (apply this if construction starts in 2026 or later).
- **2026 to 2027 (Projected)**: +2.0% (apply this if construction starts in 2027 or later).

### 2.2. Advantech Project Specific Base Costs

Based on actual project analysis (Advantech North America Campus):

| Building Component | Size | Base Cost/SF | Rationale |
|---|---|---|---|
| **HQ Building (6-story office)** | 109,117 SF | $250-350/SF | High-end commercial with specialized systems |
| **AASC Building (2-story high-bay warehouse)** | 78,945 SF | $150-200/SF | High-bay with specialized systems (ESFR, EV, ESD) |
| **Blended Average** | 188,062 SF | $200-275/SF | Mixed-use project |

---

## 3. CSI DIVISION COST ALLOCATION (% of Hard Cost)

This table provides the typical percentage of total hard costs allocated to each CSI MasterFormat division for a standard warehouse project. This serves as a primary method for cost breakdown and a crucial tool for sanity checks.

| Division | Description | % of Hard Cost | Detailed MEP Cost Reference ($/SF) |
|---|---|---|---|
| **Div 01** | General Conditions | 8% | N/A |
| **Div 03** | Concrete | 18% | N/A |
| **Div 05** | Metals (Structural Steel) | 22% | N/A |
| **Div 07** | Thermal & Moisture Protection | 6% | N/A |
| **Div 08** | Openings | 4% | N/A |
| **Div 09** | Finishes | 3% | N/A |
| **Div 21** | Fire Suppression | 3% | $1.5 - $2.5/SF (Standard), +$3-5/SF for ESFR |
| **Div 22** | Plumbing | 2% | $2 - $4/SF |
| **Div 23** | HVAC | 5% | $2 - $8/SF (Varies by type) |
| **Div 26** | Electrical | 8% | $3 - $8/SF (Varies by type) |
| **Div 27** | Communications | 1% | N/A |
| **Div 31** | Earthwork | 5% | N/A |
| **Div 32** | Exterior Improvements | 4% | N/A |
| **Div 33** | Utilities | 2% | N/A |
| **Other** | Misc. | 3% | N/A |
| **TOTAL** | | **100%** | |

**Note**: The `Detailed MEP Cost Reference ($/SF)` column is for **sanity checking only** and should not be used for primary calculation. The primary calculation should be based on the percentage of hard cost.

---

## 4. REGIONAL ADJUSTMENT FACTORS (2025-2026)

These multipliers adjust the national average base costs to account for regional differences in labor, materials, and regulatory environments.

### 4.1. Adjustment Table by State/Region

| Region | Combined Multiplier | Labor Multiplier | Material Multiplier | Building Code Premium | Site Condition Adj. |
|---|---|---|---|---|---|
| **CA - Coastal** | 1.23x | 1.28x | 1.12x | +7% | +5% |
| **CA - Inland** | 1.15x | 1.18x | 1.08x | +6% | +3% |
| **CA - Orange County** | 1.20x | 1.25x | 1.10x | +7% | +4% |
| **TX - Statewide** | 0.91x | 0.88x | 0.95x | +1% | +2% |
| **UT - Statewide** | 1.00x | 1.02x | 1.00x | +3% | +2% |
| **NV - Statewide** | 1.04x | 1.06x | 1.02x | +3% | -3% |
| **NM - Statewide** | 0.90x | 0.87x | 0.93x | +1% | -2% |

**Note**: Orange County (Tustin) should use 1.20x combined multiplier instead of 1.15x for inland CA.

### 4.2. Prevailing Wage Confirmation Protocol (CRITICAL)

**Trigger Question**: "Is this project subject to prevailing wage requirements?"

**Action**: If YES, or if project is public works in California, apply a **1.28x to 1.50x labor multiplier**, overriding the standard regional labor multiplier.

**California Prevailing Wage Rates (2026)**:
- Carpenter: 1.30-1.50x
- Ironworker: 1.27-1.55x
- Electrician: 1.33-1.58x
- Plumber: 1.36-1.64x
- **Average: 1.40x**

### 4.3. Material Cost Volatility & Lead Times

**Rule**: If the construction start date is more than 6 months away, add **+1% to +2% escalation per quarter** to the material cost component to account for price risk.

---

## 5. VERSION HISTORY

| Version | Date | Changes | Status |
|---|---|---|---|
| 1.0 | 2025-01-15 | Initial release | DEPRECATED |
| 1.1 | 2026-02-03 | Added complexity, geotechnical, and specialized systems sections | DEPRECATED |
| 1.2 | 2026-02-07 | Removed methodological sections to align with LAYER1 as the single source of truth | DEPRECATED |
| 1.3 | 2026-03-15 | Added High-Tech Manufacturing TI classification override with calibrated unit costs from 決算 comparison | PRODUCTION |

---

**END OF LAYER 2: WAREHOUSE KNOWLEDGE PROMPT v1.2 (PRODUCTION)**
