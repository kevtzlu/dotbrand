# Multi-State Construction Cost Rates
Version: 1.0
Last Updated: 2026-02-27

⚠️ CONFLICT RESOLUTION RULES:
1. Project-type-specific files take priority (HEALTHCARE_INTEGRATION_ANALYSIS for healthcare, RENOVATION_COST_FACTOR_MATRIX for renovation)
2. New construction rates only — for renovation, use RENOVATION_COST_FACTOR_MATRIX
3. If project state is not CA/NY/FL/TX, use National Average fallback and warn user
4. File names must never change — version numbers are tracked inside this file only

---

## STATE DETECTION RULES

When user mentions any of the following, activate the corresponding state rates:

California (CA):
Keywords: California, CA, Los Angeles, LA, San Francisco, SF, Bay Area, Irvine, San Diego, Sacramento, Orange County, Silicon Valley, SoCal, NorCal

New York (NY):
Keywords: New York, NY, NYC, Manhattan, Brooklyn, Queens, Bronx, Long Island, Westchester, Buffalo, Albany

Florida (FL):
Keywords: Florida, FL, Miami, Orlando, Tampa, Jacksonville, Fort Lauderdale, Boca Raton, West Palm Beach

Texas (TX):
Keywords: Texas, TX, Houston, Dallas, Austin, San Antonio, Fort Worth, DFW

Other States:
Apply CA rates × 0.90 as National Average fallback.
ALWAYS warn user: "⚠️ This project is outside CA/NY/FL/TX. Rates shown are national average estimates. We recommend obtaining local subcontractor quotes for accuracy."

---

## LABOR COST INDEX (Base = California = 1.00)
| State | Index |
|-------|-------|
| CA | 1.00 |
| NY | 1.35 |
| FL | 0.85 |
| TX | 0.80 |

Apply this index to ALL labor-intensive line items when switching states.

---

## STRUCTURAL STEEL
| Rate | CA | NY | FL | TX |
|------|----|----|----|----|
| Base Steel ($/ton) | $5,750 | $6,500 | $5,200 | $5,000 |
| BRB Seismic Premium | +15–25% (SDC D required) | +10–15% (SDC C zones) | N/A | N/A |
| Metal Decking ($/SF) | $5.50 | $6.50 | $4.80 | $4.50 |
| Misc Steel multiplier | +8–12% of base | +8–12% of base | +6–10% of base | +6–10% of base |
| SDC D Total Multiplier | 1.45–1.60 | 1.30–1.45 | 1.00 | 1.00 |

---

## CONCRETE (New Construction Only)
| Rate | CA | NY | FL | TX |
|------|----|----|----|----|
| Concrete placement ($/CY) | $700 | $850 | $600 | $580 |
| Rebar ($/SF GFA) | $10 | $12 | $7 | $6.50 |
| Rebar ($/LB) | $1.70 | $1.95 | $1.45 | $1.40 |
| Floor Finishing ($/SF) | $3.00 | $3.80 | $2.50 | $2.40 |

---

## SHEET METAL (Div 07600)
| Rate | CA | NY | FL | TX |
|------|----|----|----|----|
| Sheet Metal ($/SF perimeter) | $21 | $26 | $17 | $16 |
| Benchmark (100K+ SF) | $3.0M–$4.5M | $3.8M–$5.5M | $2.5M–$3.8M | $2.3M–$3.5M |

---

## ELEVATORS
| Type | CA | NY | FL | TX |
|------|----|----|----|----|
| Standard Passenger (6-stop, 3,500 lb) | $280K–$320K | $350K–$400K | $230K–$270K | $220K–$260K |
| High-Rise (8+ stops) | $350K–$450K | $450K–$580K | $300K–$380K | $280K–$360K |
| Freight Elevator | $200K–$280K | $260K–$340K | $170K–$230K | $160K–$220K |

---

## INSURANCE & BOND (Soft Costs — Always listed under Soft Cost section, NOT Hard Cost)
3 Separate Line Items — Non-Healthcare Projects Only

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

| Item | CA | NY | FL | TX |
|------|----|----|----|----|
| GL Insurance | 0.94% | 1.10% | 0.85% | 0.80% |
| Builder's Risk | 0.50% | 0.60% | 0.55% | 0.45% |
| P&P Bond | 1.08% | 1.20% | 0.95% | 0.90% |
| Total | 2.52% | 2.90% | 2.35% | 2.15% |

Base: % of Contract Sum

---

## GC FEE & CONTINGENCY
| Item | CA | NY | FL | TX |
|------|----|----|----|----|
| GC Fee (competitive bid) | 5% | 6% | 5% | 4.5% |
| GC Fee (negotiated/DB) | 8% | 9% | 7% | 7% |
| Contingency (Design-Build, no CD) | 10% | 12% | 10% | 8% |
| Contingency (with full CD) | 5% | 6% | 5% | 4% |
| Contingency (no geotech report) | +5% on sitework | +5% on sitework | +3% on sitework | +3% on sitework |

---

## P-VALUE PLANNING RULES (ALL STATES)
| Project Type | Recommended Planning Figure |
|---|---|
| Design-Build, no CD drawings | P80 |
| Design-Build, schematic only | P70 |
| With full CD drawings | P50 |
| With full CD + geotech report | P50 |

Rule: P50 consistently underestimates Design-Build projects by 15–20%. Always use P80 as owner budget figure for projects without complete drawings.
