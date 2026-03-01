# LAYER 2: PUBLIC WORKS KNOWLEDGE PROMPT v1.0
## Design-Bid-Build | Civil & Vertical Construction | Multi-State

**Version**: 1.0
**Status**: PRODUCTION
**Last Updated**: 2026-03-01
**Applies To**: All federally-funded, state-funded, and local government public works projects
**Delivery Method**: Primarily Design-Bid-Build (DBB); also applies to CM@Risk and Job Order Contracting (JOC) with noted exceptions
**Integrates With**: LAYER 1 v2.5, LAYER 0 v2.2, MULTI_STATE_COST_RATES_v1.0

---

## ⛔ CRITICAL: HOW THIS FILE IS TRIGGERED

This prompt is loaded when STAGE A detects ANY of the following:

**Hard Triggers (Definitive — load immediately):**
- "County of ___" / "City of ___" / "State of ___" as Owner
- "Federal Project Number" / "BRLO" / "STIP" / "ARRA" / "TIGER" / "INFRA"
- "Invitation for Bid" / "IFB" / "Notice to Bidders"
- "Prevailing Wage" / "Davis-Bacon" / "DIR Registration"
- "DBE Goal" / "MBE Goal" / "SBE Goal"
- "Performance Bond" + "Payment Bond" (100% each)
- "Liquidated Damages" in contract documents
- "Public Contract Code" / "Government Code"

**Soft Triggers (Likely public — confirm with GC):**
- "Unit Price" bid schedule (vs. Lump Sum)
- "Bid Security" / "Bid Bond" at 10%
- "Certified Payroll" requirement
- "Buy America" / "Buy American" provisions
- "SWPPP" / "NPDES" permit requirements in Div 01
- "Addendum" + numbered drawing set (e.g., "24-07-C")

**Upon detection, immediately:**
1. Flag project as `PUBLIC_WORKS = TRUE`
2. Override private-project defaults (see Section 3)
3. Ask GC: "This appears to be a public works project. Can you confirm: (a) funding source — Federal / State / Local? (b) Is this prevailing wage? (c) Are there any DBE/MBE goals?"

---

## 1. PROJECT CLASSIFICATION MATRIX

### 1.1 By Work Type

| Code | Type | Typical Scope | Notes |
|------|------|--------------|-------|
| `PW-CIVIL` | Civil / Infrastructure | Roads, bridges, utilities, drainage | Unit price dominant |
| `PW-VERTICAL` | Vertical / Building | Schools, courthouses, fire stations | Lump sum or unit price |
| `PW-WATER` | Water / Wastewater | Treatment plants, pipelines | Specialty subs required |
| `PW-TRANSIT` | Transit / Rail | Stations, platforms, grade separations | Federal FTA oversight |
| `PW-MARINE` | Marine / Port | Piers, bulkheads, dredging | Specialty marine rates |
| `PW-PARK` | Parks / Recreation | Facilities, trails, sports fields | Lower wage tier in some states |

### 1.2 By Funding Source

| Funding | Acronym | Key Compliance Requirements |
|---------|---------|---------------------------|
| Federal Highway | FHWA / BRLO / STIP | Davis-Bacon, Buy America, DBE, FHWA oversight |
| Federal Transit | FTA | Davis-Bacon, Buy America, DBE, ADA |
| Federal Water | EPA SRF | Davis-Bacon, American Iron & Steel |
| CDBG / HUD | HUD | Davis-Bacon, Section 3 |
| State-only | Varies | State prevailing wage, usually no federal overlay |
| Local-only (bond) | GO Bond | State prevailing wage only |

⚠️ **CRITICAL**: Federal funding = Davis-Bacon Act (federal prevailing wage). State funding = state prevailing wage law. Local-only may still require prevailing wage depending on state statute.

### 1.3 Delivery Method Nuances

| Method | Scope Certainty | Price Risk to GC | Notes |
|--------|----------------|-----------------|-------|
| Design-Bid-Build (DBB) | High (100% CD) | Quantity risk only | Most common public works |
| CM@Risk | Medium (60-90% CD) | Moderate | GMP established at 60-90% |
| Design-Build (DB) | Low (RFP only) | High | GC carries design risk |
| JOC | Per task order | Low | Pre-priced unit book |

---

## 2. MANDATORY PUBLIC WORKS COST ITEMS

### 2.1 Mobilization — THE MOST CRITICAL LINE ITEM

**Definition**: All costs for moving personnel, equipment, materials to site; establishing temporary facilities; obtaining required permits before productive work begins.

**⛔ NEVER embed mobilization inside Div 01 General Conditions for public works. It is ALWAYS a separate Pay Item on the bid schedule.**

#### Mobilization Rate by Project Type

| Project Type | Typical Range | Caltrans/State Cap | Notes |
|-------------|--------------|-------------------|-------|
| Road / Bridge | 4% – 10% | 10% hard cap (CA, OR, WA) | Fed-aid projects |
| Vertical Building | 2% – 5% | No cap (lump sum) | Varies by state |
| Water / Sewer | 5% – 12% | Varies by agency | Equipment-intensive |
| Marine / Bridge | 8% – 20% | No cap | High equipment cost |
| Multiple sites (any) | See formula | See formula | ↓ |

#### Multi-Site Mobilization Formula

When project has **2 or more geographically separated work areas:**

```
Step 1: Determine strategy (ask GC — see Stage 2 mandatory question)
  Option A — Sequential: One crew moves from site to site
  Option B — Simultaneous: Multiple crews work at same time
  Option C — Hybrid: Some trades sequential, others parallel

Step 2: Calculate
  Sequential:   Mob = MAX(Contract_Value × 10%, $75,000 × N_sites)
  Simultaneous: Mob = MAX(Contract_Value × 10%, $125,000 × N_sites)
  Hybrid:       Mob = Weighted average of above

  where N_sites = number of independent mobilization locations

Step 3: Seasonal constraint check (see Section 2.9)
  IF work cannot proceed continuously (irrigation season, winter shutdown, environmental window):
    → Each season restart = additional partial mobilization = +$30,000–$75,000 per restart
    → Add to base mobilization cost
```

**Example (East Reedley Bridge — 3 sites, sequential):**
```
  N_sites = 3
  Contract_Value = ~$3,000,000 (estimated)
  Mob_minimum = $75,000 × 3 = $225,000
  Mob_percentage = $3,000,000 × 10% = $300,000
  Mob = MAX($225,000, $300,000) = $300,000
  + Seasonal restart (irrigation season delay): +$40,000–$60,000
  TOTAL MOBILIZATION: ~$340,000–$360,000
```

#### Demobilization
- Always a separate pay item: typically 25%–50% of Mobilization cost
- If no separate pay item → demob is included in Mob (state this assumption)

---

### 2.2 Prevailing Wage — MANDATORY LABOR COST OVERRIDE

**⛔ RULE: If `PUBLIC_WORKS = TRUE` AND project is in a prevailing wage jurisdiction, ALL labor must be priced at prevailing wage rates. DO NOT use open-shop rates.**

#### State Prevailing Wage Overview

| State | Law | Threshold | Source | Update Frequency |
|-------|-----|-----------|--------|-----------------|
| **CA** | Labor Code §1720 | Any public works > $25,000 (general) | CA DIR | Twice yearly (Feb, Aug) |
| **NY** | Labor Law Art. 8 | Any public works | NY DOL | Annual |
| **FL** | F.S. §215.425 | Federal-funded only (Davis-Bacon) | US DOL | Annual |
| **TX** | Gov't Code Ch. 2258 | Federal-funded only; local option | US DOL | Annual |
| **WA** | RCW 39.12 | Any public works > $1,000 | L&I | Quarterly |
| **OR** | ORS 279C.800 | Any public works > $50,000 | BOLI | Annual |
| **CO** | §8-17-101 | Any public works > $400,000 | CDLE | Annual |
| **AZ** | No state PW law | Federal-funded only | US DOL | Annual |
| **NV** | NRS Ch. 338 | Any public works > $100,000 | NSIID | Annual |
| **IL** | 820 ILCS 130 | Any public works | IL DOL | Annual |
| **OH** | ORC Ch. 4115 | Any public works > $250,000 | OH DIR | Annual |
| **GA** | No state PW law | Federal-funded only | US DOL | Annual |
| **NC** | No state PW law | Federal-funded only | US DOL | Annual |
| **VA** | Va. Code §2.2-4321 | Any public works > $500,000 | DOLI | Annual |
| **MN** | §177.41 | Any public works | DLI | Annual |
| **Federal** | Davis-Bacon Act | Federal-funded > $2,000 | US DOL | Weekly updates |

#### Prevailing Wage vs. Open Shop Multiplier (Craft-Specific)

Use these multipliers when converting open-shop estimates to prevailing wage:

| Craft | CA Multiplier | NY Multiplier | FL Multiplier | TX Multiplier | National Avg |
|-------|--------------|--------------|--------------|--------------|-------------|
| Carpenter | 1.45x – 1.60x | 1.70x – 2.00x | 1.15x – 1.25x | 1.10x – 1.20x | 1.35x |
| Ironworker | 1.50x – 1.65x | 1.75x – 2.10x | 1.15x – 1.30x | 1.10x – 1.25x | 1.40x |
| Operating Engineer | 1.45x – 1.60x | 1.65x – 1.90x | 1.15x – 1.25x | 1.10x – 1.20x | 1.35x |
| Laborer | 1.40x – 1.55x | 1.60x – 1.85x | 1.10x – 1.20x | 1.05x – 1.15x | 1.30x |
| Cement Mason | 1.45x – 1.60x | 1.70x – 1.95x | 1.12x – 1.22x | 1.08x – 1.18x | 1.35x |
| Electrician | 1.50x – 1.70x | 1.80x – 2.20x | 1.20x – 1.35x | 1.15x – 1.30x | 1.45x |
| Plumber | 1.50x – 1.70x | 1.80x – 2.15x | 1.20x – 1.35x | 1.15x – 1.30x | 1.45x |
| Teamster | 1.40x – 1.55x | 1.60x – 1.85x | 1.10x – 1.20x | 1.05x – 1.15x | 1.30x |
| Painter | 1.40x – 1.55x | 1.65x – 1.90x | 1.10x – 1.20x | 1.05x – 1.15x | 1.32x |

**⚠️ IMPORTANT**: Always verify current rates from official source before finalizing estimate. Rates above are guidance only — actual rates vary by county/zone/classification.

#### Real-Time Lookup Protocol
```
1. CA Projects: Search "CA DIR Prevailing Wage [County] [Trade] [Current Year]"
2. Federal Projects: Search "SAM.gov Wage Determinations [State] [County] [Current Year]"
3. Other States: Search "[State] DOL Prevailing Wage [Trade] [Current Year]"
```

---

### 2.3 Bonds & Insurance — PUBLIC WORKS MANDATORY MINIMUMS

**⛔ RULE: Public works bonds are NOT optional. Price them into every public works bid.**

#### Bond Requirements

| Bond Type | Coverage | Typical Cost | Notes |
|-----------|----------|-------------|-------|
| Bid Bond | 10% of bid | Negligible (surety letter) | Forfeited if awarded but GC doesn't sign |
| Performance Bond | 100% of contract | 0.5% – 1.5% of contract | Required by law in all states |
| Payment Bond | 100% of contract | Included in above | Required for federal-aid and most state |
| Maintenance Bond | 1–3 years warranty | 0.25% – 0.5% of contract | Required by some agencies |

**Bond Premium Rate by GC Tier:**
```
Tier 1 (Large GC, strong financials): 0.5% – 0.8%
Tier 2 (Mid-size GC, good history):   0.8% – 1.2%
Tier 3 (Small GC, limited history):   1.2% – 2.0%
Tier 4 (New/distressed GC):           2.0% – 3.0%+
```

**Insurance Minimums (Public Works):**
| Coverage | Private Project | Public Works (Typical) | Federal-Aid |
|----------|----------------|----------------------|-------------|
| General Liability | $1M / $2M | $2M / $4M | $5M / $10M |
| Auto Liability | $1M | $1M | $2M |
| Workers Comp | Statutory | Statutory | Statutory |
| Umbrella | $5M | $10M | $20M |

**Total Bond + Insurance Cost:**
```
Private project:      1.0% – 1.5% of hard cost
Public Works:         2.5% – 3.5% of hard cost
Federal-Aid Large:    3.0% – 4.0% of hard cost
```

---

### 2.4 DBE / MBE / SBE Compliance Costs

**Trigger**: Any federal-aid project, or state/local projects with diversity goals.

| Cost Category | Amount | Notes |
|--------------|--------|-------|
| DBE subcontractor premium | +5% – 15% above market | DBE subs often smaller, higher overhead |
| Admin / tracking software | $5,000 – $15,000 | Monthly DBE reporting |
| Good Faith Effort documentation | $10,000 – $25,000 | If goal not met |
| Post-award DBE compliance | $5,000 – $10,000/yr | Certified payroll, reports |

**DBE Calculation Rule:**
```
IF DBE_Goal > 0%:
  For each trade covered by DBE sub:
    Estimated_DBE_Premium = Trade_Cost × 8%  (conservative estimate)
  Total_DBE_Impact = Sum of all trade premiums
  Add to Div 01 or as separate line: "DBE Compliance Premium"
```

**⚠️ DO NOT assume DBE subs bid at market rate. A DBE concrete sub may bid $180/CY where market is $150/CY. Factor this premium into the total bid.**

---

### 2.5 Liquidated Damages — SCHEDULE RISK QUANTIFICATION

#### Typical LD Rates by Project Type

| Project Type | CA Caltrans | FHWA Federal | Typical Local Agency |
|-------------|-------------|-------------|---------------------|
| Local road resurfacing | $1,000/day | — | $500–$2,000/day |
| Bridge replacement (<$5M) | $2,000–$5,000/day | $2,000–$4,000/day | $1,500–$4,000/day |
| Major bridge (>$5M) | $5,000–$15,000/day | $5,000–$10,000/day | $3,000–$10,000/day |
| School construction | — | — | $1,000–$3,000/day |
| Water treatment plant | — | — | $2,000–$8,000/day |
| Airport improvement | — | FAA: $5,000–$25,000/day | — |

#### LD Risk Quantification Formula
```
Risk_Premium = LD_Rate × Estimated_Delay_Days × Probability_of_Delay
Example: $3,000/day × 15 days × 30% probability = $13,500
Add to contingency or OH&P as "Schedule Risk Premium"
```

**⛔ MANDATORY: If LD rate > $5,000/day, flag for GC review before finalizing bid.**

---

### 2.6 Federal-Aid Compliance Admin Costs

| Compliance Item | Cost | Frequency |
|----------------|------|-----------|
| Certified Payroll preparation | $500–$1,500/week | Weekly |
| Labor compliance officer | $80,000–$120,000/yr | Full project |
| DBE monthly reporting | $500–$1,000/month | Monthly |
| Buy America certification | $2,000–$5,000 | Per submittal |
| Environmental monitoring (NPDES/SWPPP) | $3,000–$8,000/month | Monthly |
| Traffic control plan (TCP) | $15,000–$50,000 | One-time design |
| Storm water / BMP maintenance | $2,000–$5,000/month | Monthly |

**Total Federal-Aid Admin Overhead: +2.5% – 5.0% of hard cost**
(Higher for smaller projects due to fixed admin burden)

---

### 2.7 Buy America / Buy American Act

| Requirement | Coverage | Cost Impact |
|-------------|----------|-------------|
| Buy America (FHWA) | All steel & iron permanently incorporated | +5%–12% material cost |
| Buy American (FTA) | Steel, iron, manufactured goods | +5%–15% material cost |
| Build America, Buy America (2022 IIJA) | Expanded to ALL infrastructure materials | +3%–10% (varies) |

**GC must verify:**
1. All structural steel: domestic mill certification required
2. All rebar: domestic source (ACS, Nucor, CMC, etc.)
3. Pipe: domestic only (HDPE, ductile iron, etc.)

---

### 2.8 Traffic Control (Road / Bridge Projects)

| Scenario | Typical Cost | Notes |
|----------|-------------|-------|
| Simple lane closure (<1 month) | $5,000–$20,000 | Flaggers, signs, delineators |
| Full street closure with detour | $25,000–$75,000/closure | Detour signing, barriers |
| Multi-lane highway closure | $50,000–$150,000/closure | Police detail may be required |
| Long-term closure (months) | $5,000–$15,000/month ongoing | Maintenance of traffic |
| Detour road construction | $50,000–$500,000 | If temporary road needed |

**Flaggers (Prevailing Wage):**
```
CA: $45–$55/hour
NY: $55–$75/hour
FL: $18–$25/hour
TX: $18–$22/hour
WA: $40–$50/hour
```

---

### 2.9 Seasonal / Environmental Constraints

**⛔ CRITICAL: Any constraint that forces work stoppage = additional mobilization cost AND schedule risk.**

| Constraint | Typical States | Typical Window | Cost Impact |
|-----------|---------------|----------------|-------------|
| Irrigation season (in-channel) | CA, CO, AZ, NV, ID | Apr–Sep (varies by district) | Mob restart $30K–$75K |
| Fish passage window | WA, OR, CA, AK | Oct–Jan (varies by species) | Mob restart + $50K–$200K |
| Migratory bird nesting | All states | Mar–Aug | Work stoppage risk |
| Winter shutdown (Northern states) | MN, WI, MI, IL, OH, NY | Nov–Mar | Winterization $20K–$50K |
| Hurricane season (shutdown) | FL, TX, LA | Jun–Nov | Standby cost |
| Wildfire season (restrictions) | CA, OR, WA | Jun–Oct | Equipment use restrictions |
| School year restrictions (near schools) | All | Sep–Jun (daytime) | Night/weekend premium +20–35% |
| Environmental mitigation window | All (project-specific) | Varies | Specialist + monitoring cost |

**Seasonal Constraint Cost Formula:**
```
IF seasonal_constraint_detected:
  Additional_Mob_Cost = $30,000–$75,000 per forced restart
  Standby_Equipment_Cost = Daily_rate × Idle_days
  Winter_Protection = $20,000–$50,000 if temperature drops below freezing
  → Add these to Mobilization line item with clear notation
  → Flag season-spanning schedule in Risk Register
```

---

### 2.10 General Conditions — Public Works Specific Additions

**Add to Div 01 (Public Works ONLY):**

| Item | Cost | Notes |
|------|------|-------|
| Project sign / ID board | $1,500–$5,000 | Required by most agencies |
| Pre-construction survey / documentation | $5,000–$25,000 | Protects GC from claims |
| Materials testing (if GC-paid) | $15,000–$50,000 | Often Owner's cost — verify |
| Submittal / shop drawing management | $10,000–$30,000 | More submittals than private |
| As-built drawings | $5,000–$20,000 | Mandatory for public projects |
| Final completion / punch list | $10,000–$25,000 | Longer process in public works |

---

## 3. PUBLIC WORKS COST OVERRIDES (Replaces Private Defaults)

When `PUBLIC_WORKS = TRUE`, override these Layer 1 defaults:

| Parameter | Private Default | Public Works Override | Reason |
|-----------|----------------|----------------------|--------|
| Labor rates | Open shop | Prevailing wage (state/federal) | Legal requirement |
| Bond + Insurance | 1.0%–1.5% | 2.5%–3.5% | P&P bonds required |
| Mobilization | Embedded in Div 01 | Separate pay item, 4%–10% | Bid schedule requirement |
| OH&P (see scale below) | 5%–10% | See Nuisance Premium table | Complexity + admin burden |
| Contingency | 5%–10% | 8%–15% | Higher regulatory risk |
| Admin overhead | 0.5%–1.0% | 2.5%–5.0% | Federal compliance costs |
| Schedule risk | 1%–3% | 2%–5% + LD risk calc | LD exposure |

---

## 4. OH&P — PUBLIC WORKS NUISANCE PREMIUM TABLE

| Project Value | Recommended OH&P | Rationale |
|--------------|-----------------|-----------|
| < $500K | 25%–35% | Fixed overhead relative to tiny contract |
| $500K–$2M | 18%–25% | Small project, high admin/compliance burden |
| $2M–$10M | 12%–18% | Mid-range, Nuisance Premium applies |
| $10M–$50M | 8%–13% | Competitive range |
| > $50M | 5%–9% | Volume driven |

**Adjust UP by:**
- +2%–3% if project spans > 18 months
- +2%–5% if new agency (no prior relationship)
- +1%–3% if tight LD schedule
- +2%–4% if DBE goal > 20%
- +1%–2% if federal-aid overlay

**Adjust DOWN by:**
- -1%–2% if agency is known/trusted partner
- -1%–2% if straightforward scope (no seasonal/environmental constraints)

---

## 5. MULTI-STATE PREVAILING WAGE QUICK REFERENCE

### California (CA)
```
Source: DIR.CA.GOV → Public Works Payroll Reporting
Update: Twice yearly (February, August)
Estimated 2025-2026 Total Package (verify on DIR before finalizing):
  Carpenter:          $112–$130/hr
  Ironworker:         $120–$145/hr
  Operating Engineer: $118–$140/hr
  Laborer:            $82–$98/hr
  Electrician:        $135–$165/hr (IBEW)
  Cement Mason:       $105–$122/hr
  Teamster:           $78–$92/hr
Zone note: Bay Area = highest; Inland Empire/Central Valley = moderate
```

### New York (NY)
```
Source: NY DOL → Bureau of Public Work
Update: Annual (January)
Estimated 2025 NYC Total Package (verify on NY DOL):
  Carpenter (NYC):    $175–$210/hr
  Ironworker (NYC):   $180–$220/hr
  Laborer (NYC):      $135–$160/hr
  Electrician (NYC):  $195–$240/hr
Upstate multiplier: 0.65x–0.80x of NYC rates
```

### Florida (FL)
```
Source: US DOL → SAM.gov (Federal projects only; no state PW law)
Estimated 2025 Base + Fringe (Davis-Bacon, verify on SAM.gov):
  Carpenter:    $28–$38/hr
  Ironworker:   $30–$42/hr
  Laborer:      $18–$25/hr
  Electrician:  $32–$45/hr
Note: Significantly below CA/NY rates
```

### Texas (TX)
```
Source: US DOL → SAM.gov (Federal projects only; no mandatory state PW law)
Estimated 2025 Base + Fringe (verify on SAM.gov):
  Carpenter:    $26–$35/hr
  Ironworker:   $28–$38/hr
  Laborer:      $16–$22/hr
  Electrician:  $30–$42/hr
Note: Houston, Dallas, Austin local market may be higher
```

### Washington (WA)
```
Source: L&I.WA.GOV → Prevailing Wage
Update: Quarterly
Estimated 2025-2026 Total Package:
  Carpenter:    $95–$118/hr
  Ironworker:   $105–$128/hr
  Laborer:      $72–$88/hr
King County (Seattle) = highest tier
```

### Oregon (OR)
```
Source: BOLI.OREGON.GOV
Update: Annual
Estimated 2025-2026 Total Package:
  Carpenter:    $85–$105/hr
  Laborer:      $68–$82/hr
Portland metro = highest tier
```

### Colorado (CO)
```
Source: CDLE.COLORADO.GOV | Threshold: $400,000+
Estimated 2025-2026 Total Package:
  Carpenter:    $75–$95/hr
  Laborer:      $58–$72/hr
Denver metro higher than rural
```

### Nevada (NV)
```
Source: DIR.NV.GOV | Threshold: $100,000+
Estimated 2025-2026 Total Package:
  Carpenter:    $82–$102/hr
  Laborer:      $65–$80/hr
Clark County (Las Vegas) significantly higher than rural
```

### Illinois (IL)
```
Source: IL DOL | All public works
Estimated 2025-2026 Total Package:
  Carpenter (Chicago):   $130–$155/hr
  Ironworker (Chicago):  $138–$168/hr
  Laborer (Chicago):     $98–$118/hr
Downstate IL: 0.60x–0.75x of Chicago rates
```

### Other States — National Average Fallback
```
For states not listed above:
  Apply CA rates × 0.85 as National Average baseline
  ⚠️ ALWAYS WARN: "These are estimated rates. Obtain local quotes and
  verify with state DOL before finalizing public works bid."

High-wage states (CA × 0.90–1.10): MA, CT, MN, NJ, HI
Low-wage states (CA × 0.65–0.75):  AL, MS, AR, KY, TN, SC, OK, WY, MT, ND, SD, ID
```

---

## 6. CIVIL / INFRASTRUCTURE UNIT PRICES

### 6.1 Earthwork & Grading

| Item | CA | WA/OR | FL | TX | Natl Avg |
|------|----|----|----|----|----------|
| Unclassified excavation ($/CY) | $28–$45 | $25–$40 | $15–$25 | $12–$20 | $20–$35 |
| Rock excavation ($/CY) | $85–$150 | $80–$140 | $60–$100 | $55–$90 | $70–$120 |
| Embankment ($/CY) | $18–$28 | $16–$25 | $10–$18 | $8–$15 | $12–$22 |
| Import borrow ($/CY) | $35–$55 | $32–$50 | $22–$35 | $18–$28 | $25–$42 |
| Export/disposal ($/CY) | $40–$75 | $35–$65 | $20–$35 | $18–$28 | $28–$50 |

### 6.2 Asphalt Pavement (AC)

| Item | CA | WA/OR | FL | TX | Natl Avg |
|------|----|----|----|----|----------|
| AC overlay 2" ($/SY) | $18–$28 | $16–$26 | $12–$18 | $10–$15 | $13–$22 |
| AC overlay 4" ($/SY) | $32–$48 | $28–$44 | $20–$30 | $17–$25 | $22–$38 |
| Cold plane removal ($/SY) | $4.00–$7.00 | $3.50–$6.50 | $2.50–$4.50 | $2.00–$4.00 | $3.00–$5.50 |
| Chip seal ($/SY) | $4.00–$7.00 | $3.50–$6.50 | $2.50–$4.50 | $2.00–$3.50 | $3.00–$5.50 |

### 6.3 Concrete Pavement & Flatwork

| Item | CA | WA/OR | FL | TX | Natl Avg |
|------|----|----|----|----|----------|
| PCC pavement 8" ($/SY) | $75–$110 | $68–$100 | $52–$78 | $45–$68 | $58–$88 |
| Sidewalk 4" ($/SF) | $8.00–$13.00 | $7.50–$12.00 | $5.50–$9.00 | $4.50–$7.50 | $6.00–$10.00 |
| Curb & gutter ($/LF) | $38–$58 | $35–$55 | $25–$40 | $20–$32 | $28–$46 |
| Concrete median barrier ($/LF) | $55–$85 | $50–$80 | $35–$55 | $30–$48 | $40–$65 |
| Retaining wall CIP ($/SF face) | $65–$100 | $60–$95 | $45–$70 | $38–$60 | $50–$80 |

### 6.4 Bridge Work (Structure)

| Item | CA | WA/OR | FL | TX | Natl Avg |
|------|----|----|----|----|----------|
| Bridge demolition ($/SF deck) | $35–$60 | $30–$55 | $20–$38 | $18–$32 | $25–$48 |
| CIP concrete box culvert ($/LF) | $1,800–$3,500 | $1,600–$3,200 | $1,200–$2,400 | $1,000–$2,000 | $1,400–$2,800 |
| Cast-in-place bridge deck ($/SF) | $180–$280 | $160–$260 | $120–$200 | $100–$175 | $135–$225 |
| Precast concrete girder ($/LF) | $280–$420 | $260–$400 | $200–$320 | $175–$280 | $220–$360 |
| Steel bridge ($/SF deck) | $350–$550 | $320–$520 | $260–$420 | $220–$360 | $285–$460 |
| Drilled shaft ($/LF) | $450–$750 | $400–$700 | $300–$520 | $260–$440 | $350–$600 |

### 6.5 Underground Utilities

| Item | CA | WA/OR | FL | TX | Natl Avg |
|------|----|----|----|----|----------|
| Water main 8" ($/LF) | $85–$140 | $75–$130 | $55–$90 | $45–$75 | $62–$108 |
| Water main 12" ($/LF) | $110–$180 | $100–$165 | $70–$115 | $58–$95 | $80–$138 |
| Sewer main 8" ($/LF) | $90–$150 | $80–$135 | $60–$95 | $50–$80 | $68–$115 |
| Storm drain 18" ($/LF) | $75–$125 | $68–$115 | $48–$80 | $40–$65 | $56–$96 |
| Storm drain 36" ($/LF) | $150–$250 | $135–$230 | $95–$160 | $80–$130 | $112–$192 |
| Manhole ($/EA) | $4,500–$8,000 | $4,000–$7,500 | $2,800–$5,200 | $2,400–$4,200 | $3,200–$6,200 |
| Fire hydrant assembly ($/EA) | $6,500–$10,000 | $6,000–$9,500 | $4,500–$7,500 | $3,800–$6,500 | $5,000–$8,200 |

### 6.6 Traffic Control & Signing

| Item | CA | Natl Avg |
|------|----|----|
| Construction area signs ($/LS) | $5,000–$25,000 | $3,000–$18,000 |
| Flagger (per 8-hr shift) | $360–$440 | $180–$280 |
| Portable CMS sign ($/month) | $1,500–$3,000 | $1,000–$2,200 |
| Traffic signal work ($/signal) | $85,000–$180,000 | $65,000–$140,000 |
| Pavement striping ($/LF) | $0.35–$0.75 | $0.22–$0.55 |

---

## 7. STAGE-SPECIFIC TRIGGER RULES

### Stage A Intake Checklist (ask immediately upon public works detection):

```
PUBLIC WORKS INTAKE — MANDATORY QUESTIONS:

1. FUNDING: Federal-aid / State-funded / Local bond / Mixed?
2. AGENCY: Who is the Owner? (Caltrans / County / City / School District / Port?)
3. DELIVERY: DBB / CM@Risk / Design-Build / JOC?
4. PREVAILING WAGE: Confirmed yes/no? Which state? Which trade classifications?
5. DBE/MBE GOAL: What percentage?
6. LIQUIDATED DAMAGES: LD rate ($/day) from contract?
7. MOBILIZATION SITES: How many geographically separate work locations?
8. SEASONAL CONSTRAINTS: Any work windows or environmental restrictions?
9. BID FORMAT: Unit Price or Lump Sum?
10. BUY AMERICA: Does this project require Buy America provisions?
```

### Stage 2 Additional Questions (public works only):
```
1. Has a geotechnical report been completed?
2. Are there utility conflicts requiring potholing/coordination?
3. Is a Traffic Control Plan (TCP) required? Who designs it — GC or Owner?
4. Any environmental permits (404, 401, CEQA/NEPA) with work windows?
5. Is the site in a FEMA flood zone?
6. Any right-of-way acquisition issues? (Delays = LD risk)
```

---

## 8. SANITY CHECK — PUBLIC WORKS ADDITIONS (Steps 9 & 10)

Add to standard 8-step sanity check from Layer 1:

**Step 9: Public Works Multiplier Validation**
```
Verify total bid includes ALL of:
  ✅ Prevailing wage labor rates (not open-shop)
  ✅ Performance & Payment Bonds (1.0%–2.0%)
  ✅ Enhanced insurance (2.5%–3.5% total with bonds)
  ✅ Mobilization as separate line item (4%–10%)
  ✅ DBE compliance premium (if applicable)
  ✅ Federal-aid admin overhead (if applicable)
  ✅ Liquidated damages risk premium (if applicable)
  ✅ Seasonal restart costs (if applicable)

Benchmark: Public Works Total should be +25%–50% above equivalent private project.
IF ratio < 1.20 → ⚠️ LIKELY MISSING PUBLIC WORKS COST ITEMS — review checklist
IF ratio > 1.60 → ⚠️ VERIFY NO DOUBLE-COUNTING
```

**Step 10: Unit Price Completeness Check (DBB only)**
```
For each unit price line item:
  □ Unit is correct (CY, SY, LF, EA, LS, SF)?
  □ Quantity is from bid schedule (not self-estimated)?
  □ Prevailing wage labor embedded in unit rate?
  □ Material source risk considered (delivery lead times, escalation)?
  □ Production rate is achievable given site conditions and season?
```

---

## 9. REFERENCE CALCULATION — EAST REEDLEY BRIDGE (3-SITE CA FEDERAL-AID)

*Use this as calibration reference for similar bridge replacement projects.*

```
Project:  3 concrete box culvert bridge replacements
Location: Fresno County, CA
Funding:  FHWA (BRLO federal-aid)
Award:    American Paving Co. came 2nd place — use as market benchmark

COMPONENT BREAKDOWN:

Civil Work (3 bridges):
  Demo 3 existing bridges:       1,500 SF × $45/SF       =    $67,500
  CIP box culverts (3):          3 × 35 LF × $2,800/LF   =   $294,000
  Bridge deck/approaches:                                 =   $180,000
  Rock slope protection/channel:                          =   $120,000
  Subtotal Civil:                                         =   $661,500

Traffic Control:
  3 full street closures:        3 × $45,000              =   $135,000
  Ongoing MOT (6 months):        6 × $8,000               =    $48,000
  Subtotal TC:                                            =   $183,000

Mobilization (3 sites, sequential, seasonal):
  Base: MAX(10% × $2.5M, $75K × 3)                       =   $300,000
  Irrigation season restart:                              =    $50,000
  Subtotal Mob:                                           =   $350,000

Div 01 General Conditions:
  Duration: ~12 months × $35,000/month                   =   $420,000

Bonds & Insurance (3.0%):
  3.0% × $2,500,000                                      =    $75,000

Federal-Aid Admin Overhead (3.5%):
  3.5% × $2,500,000                                      =    $87,500

DBE Compliance Premium (22% goal, 8% premium):
  $550,000 × 8%                                          =    $44,000

HARD COST SUBTOTAL:                                      ~ $1,821,000

Prevailing Wage Uplift (Fresno County, CA):
  Labor portion ~40%: $1,821,000 × 40% = $728,400
  PW multiplier 1.45x: additional                        =   $327,780
  Adjusted Hard Cost:                                    ~ $2,148,780

OH&P ($2M–$10M federal-aid range, 15%):
  15% × $2,148,780                                       =   $322,317

TOTAL BID ESTIMATE:                                      ~ $2,471,097
Round to:                                                ~ $2,450,000–$2,550,000

SANITY CHECK:
  $2,500,000 ÷ 3 bridges ÷ 500 SF deck = $1,667/SF
  CA bridge range: $1,200–$2,200/SF ✅ PASS
```

---

## 10. VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-01 | Initial production release. Multi-state PW, federal-aid compliance, civil unit prices, multi-site mobilization, seasonal constraints, DBE, LD risk quantification. |

---

**END OF LAYER 2: PUBLIC WORKS KNOWLEDGE PROMPT v1.0**
