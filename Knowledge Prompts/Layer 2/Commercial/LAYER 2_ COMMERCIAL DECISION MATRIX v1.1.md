# LAYER 2: COMMERCIAL DECISION MATRIX v1.1 (PRODUCTION)

**Version**: 1.1 (Updated 2026-02-09)
**Status**: PRODUCTION
**Last Updated**: 2026-02-09
**Purpose**: Quick assessment tool for commercial office projects (including renovation cost factor application)

---

## 1. QUICK ASSESSMENT QUESTIONNAIRE

1.  **Building Class**: (A) Class A, (B) Class B, (C) Class C
2.  **Core Factor**: (A) High (above 25%), (B) Medium (15-25%), (C) Low (below 15%)
3.  **LEED Certification**: (A) Platinum/Gold, (B) Silver/Certified, (C) None
4.  **Project Type**: (A) New Construction, (B) Renovation/Tenant Improvement

---

## 2. QUICK COST CALCULATOR

*   **Base Cost/SF**: (from Knowledge Base)
*   **Class Adjustment**: Class A (+15%), Class B (+5%), Class C (0%)
*   **LEED Adjustment**: Platinum/Gold (+10%), Silver/Certified (+5%), None (0%)
*   **Project Type Adjustment**: 
    - New Construction: 1.0x
    - Renovation: Apply Renovation Cost Factor (see Section 3)

---

## 3. RENOVATION COST FACTOR APPLICATION

### Commercial Office Renovation Cost Multipliers

Based on **RENOVATION_COST_FACTOR_MATRIX_v1.0.yaml**, commercial office renovation projects have the following cost multipliers:

#### Base Renovation Factor: 1.8x

Commercial renovation cost = New construction cost × Renovation factor × Regional adjustment

#### By Renovation Scope

| Renovation Scope | Factor | Description | Typical Work |
|-----------------|--------|-------------|--------------|
| **Light** | 1.2x | Cosmetic updates, minimal system replacement | Paint, flooring, lighting, minor electrical |
| **Moderate** | 1.8x | Partial system replacement, significant updates | Flooring, walls, HVAC, electrical, plumbing, finishes |
| **Heavy** | 2.5x | Complete system replacement, major structural changes | Complete gut, structural changes, full MEP replacement |

#### By Region

| Region | Adjustment | Labor Index | Description |
|--------|------------|-------------|-------------|
| CA Inland | 0.95x | 1.15 | Inland California, moderate labor costs |
| CA Coastal | 1.10x | 1.25 | Coastal California, higher labor costs |
| CA Bay Area | 1.15x | 1.35 | Bay Area, highest labor costs in California |
| TX Coastal | 0.90x | 1.05 | Texas coastal, moderate labor costs |
| TX Inland | 0.85x | 1.00 | Texas inland, lower labor costs |
| NY Urban | 1.20x | 1.40 | New York urban, high labor costs |
| FL Statewide | 0.88x | 1.02 | Florida, moderate labor costs |

#### Cost Drivers

Main cost drivers for commercial office renovation:

| Cost Driver | Cost Impact | Description |
|-------------|------------|-------------|
| **HVAC Replacement** | +20-30% | HVAC system upgrade (VRF, chiller, ductwork) |
| **Electrical Replacement** | +15-25% | Electrical system upgrade (panels, wiring, outlets) |
| **Plumbing Replacement** | +10-15% | Plumbing system upgrade (supply, drainage) |
| **Interior Finishes** | +30-40% | Interior finishes (flooring, walls, ceilings, doors) |
| **Fire Protection** | +10-20% | Fire protection system upgrade |
| **Structural Reinforcement** | +5-10% | Seismic reinforcement, structural upgrades |

#### Application Example

**Hypothetical Case: Bay Area Commercial Renovation (Moderate)**

```
Building Type: Commercial Office
Renovation Scope: Moderate
Location: Santa Clara, CA (Bay Area)

Step 1: Get base factor
base_factor = 1.8x (from matrix)

Step 2: Get regional adjustment
regional_adjustment = 1.15x (CA Bay Area)

Step 3: Calculate final factor
final_factor = 1.8 × 1.15 = 2.07x

Step 4: Apply to new construction cost
new_construction_cost = $400/SF
renovation_cost = $400 × 2.07 = $828/SF

Step 5: Apply complexity multiplier
complexity_multiplier = 1.2x (simple project)
adjusted_cost = $828 × 1.2 = $993.60/SF

Step 6: Calculate total cost
building_area = 5,000 SF
total_cost = $993.60/SF × 5,000 SF = $4,968,000
```

#### Confidence Level

- **HIGH**: Multiple validated projects (3+)
- **MEDIUM**: Some validated projects (1-2)
- **LOW**: No validated projects (estimated)

**Commercial Office Renovation Factor Confidence**: **HIGH** (Validated with YTEC Scott Boulevard project)

#### Integration with Decision Matrix

1. **Stage 1**: Determine if project is new construction or renovation
2. **Stage 2**: If renovation, determine renovation scope (Light/Moderate/Heavy)
3. **Stage 3**: Use this section's renovation factors for preliminary estimate
4. **Stage 4**: Use LAYER1 for detailed calculation
5. **Stage 5**: Generate final report

---

**END OF LAYER 2: COMMERCIAL DECISION MATRIX v1.1 (PRODUCTION)**

**Updated**: 2026-02-09 - Added Renovation Cost Factor Application section
