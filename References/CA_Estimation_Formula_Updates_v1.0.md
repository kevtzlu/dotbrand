# CA Estimation Formula Updates
Version: 1.0
Last Updated: 2026-02-27
Source: Advantech Project Post-Mortem Analysis

⚠️ CONFLICT RESOLUTION RULES:
1. Project-type-specific files take priority over this file (e.g. HEALTHCARE_INTEGRATION_ANALYSIS takes priority for healthcare projects)
2. New construction rates ≠ Renovation rates — never mix. Use RENOVATION_COST_FACTOR_MATRIX for renovation projects.
3. More recent validation data takes priority over older estimates
4. If conflict exists between files, AI must flag it to user and ask for clarification
5. These rates apply to: New Construction, Design-Build, Ground-Up projects only

---

## UPDATE #1: SDC D Steel Structure Multiplier
Applies to: All projects in Seismic Design Category D (high seismic zones in CA)

Old Formula:
Steel_Cost = Tonnage × $5,750/ton

New Formula:
Steel_Cost = (Tonnage × $5,750/ton)
           + BRB_System (SDC D: +15–25% of base steel)
           + Metal_Decking (separate line: SF × $5.50/SF)
           + Misc_Steel (stairs, embeds: +8–12% of base steel)

SDC D Total Multiplier: Base Steel × 1.45–1.60

Rule: In SDC D seismic zones, SMRF steel structures MUST include BRB (Buckling Restrained Braces). This is a code requirement, not optional. Budget $500K–$1.5M depending on building height.

---

## UPDATE #2: Sheet Metal — Mandatory Separate Line Item (CA Market)
Applies to: All CA commercial projects with exterior cladding

New Line Item: Div 07600 Sheet Metal (Tinco-type subcontractor)
Sheet_Metal_Cost = Building_Perimeter_SF × $18–$25/SF

Includes: ACM Panels + Metal Panels + Coping + Gutters + Flashings

CA Benchmark: $3.0M–$4.5M for 100,000+ SF mixed-use projects

Rule: Sheet Metal is a SEPARATE subcontractor in CA market. Do NOT bundle into Div 08 Glazing. Always list Div 07600 as an independent line item.

---

## UPDATE #3: Concrete — Three-Line Split Formula
Applies to: All CA public works and large commercial projects (new construction only)

Old Formula:
Concrete_Cost = CY × Unit_Rate (all-in)

New Formula (3 separate line items):
- Div 03100 Concrete (placement only) = CY × $650–$750/CY
- Div 03200 Rebar = SF_GFA × $8–$12/SF (or LB × $1.70/LB)
- Div 03350 Floor Finishing = SF × $2.50–$4.00/SF (grind/polish/seal)

CA PW Rebar Benchmark: $8–$12/SF GFA

Rule: Rebar is a separate subcontractor. Never bundle into concrete unit price.
Note: For renovation projects, use RENOVATION_COST_FACTOR_MATRIX rates instead.

---

## INSURANCE & BOND (Soft Costs — Always listed under Soft Cost section, NOT Hard Cost)
Applies to: All CA large projects (contract sum > $10M), new construction only

CONFLICT NOTE: HEALTHCARE_INTEGRATION_ANALYSIS uses "Insurance = 2% of soft costs" — that applies to healthcare projects only. For all other project types, use the rates below.

Rule: GL Insurance, Builder's Risk, and P&P Bond are ALL Soft Costs.
They must NEVER appear under Hard Cost or GC Fee sections.
Always place them in a dedicated "Soft Costs" section of the estimate.

Soft Cost section order:
1. A/E Design & Engineering
2. Permits & Fees
3. Project Management / CM
4. GL Insurance
5. Builder's Risk Insurance
6. P&P Bond

Old Formula:
Insurance = Hard_Cost × 1.75%

New Formula (3 separate line items under Soft Costs):
- GL Insurance = Contract_Sum × 0.88%–1.00%
- Builder's Risk = Contract_Sum × 0.45%–0.55%
- P&P Bond = Contract_Sum × 1.00%–1.15%
- Total: Contract_Sum × 2.33%–2.70%

CA Standard: Use 2.5% as default for large CA private projects.

Rule: Always list as THREE separate line items. Never combine into a single percentage.

---

## UPDATE #5: Elevator Unit Price Update (CA Market)
Applies to: All CA projects with elevators

Old Price: Elevator = $185,000/cab

New Prices (CA, Kone/Otis brands):
- Standard Passenger (6-stop, 3,500 lb) = $280,000–$320,000/cab
- High-Rise (8+ stops) = $350,000–$450,000/cab
- Freight Elevator = $200,000–$280,000/cab

Validated benchmark: Advantech project actual = $309,313/cab (4 cabs, Kone)

Rule: Always confirm exact cab count from BOD per building. Never assume.

---

## GENERAL RULES FROM ADVANTECH LESSONS LEARNED

1. P80 is the planning number for Design-Build projects without CD drawings. P50 consistently underestimates by 15–20%.
2. SDC D projects: Always add seismic premium to structural, MEP, and architectural budgets.
3. Elevator count: Must be confirmed per building from BOD. Never assume.
4. Without geotech report: Add mandatory 5–10% contingency on sitework.
