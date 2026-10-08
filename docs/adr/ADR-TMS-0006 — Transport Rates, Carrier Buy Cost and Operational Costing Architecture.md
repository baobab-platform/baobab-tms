# ADR-TMS-0006 — Transport Rates, Carrier Buy Cost and Operational Costing Architecture

**Status:** Proposed — architectural review; not yet accepted or implemented  
**Date:** 2026-10-08  
**Repository:** baobab-platform/baobab-tms  
**Depends on:** Accepted ADR-TMS-0001 and ADR-TMS-0002; TMS-TECH-01 (separate technology proposal); applicable Shared contracts  
**Authority:** Shared for canonical contract and event publication; CP for provider/tenant binding and certification; IAM for identity  

> **Evidence boundary:** This ADR defines proposed domain/implementation rules. It does not create a deployed service, implemented capability, certified provider, qualified carrier, regulatory approval or live integration.


## 1. Decision
TMS owns **operational cost inputs**, rate observations and a reproducible **transport buy-cost estimate**, not final customer sale price, margin, tax invoice, payable posting, settled payment or accounting truth. Monetary amounts are decimal-safe with explicit currency, tax treatment, units, provenance and validity windows. This ADR does not activate an automated quoting product.

```text
Carrier offer / contracted buy tariff / authorised rate table
   + planned route, cargo, transport service and accessorial assumptions
   -> TMS OperationalCostEstimate (versioned, scenario-specific)
   -> Trade commercial pricing / service quotation as permitted
   -> ERP actual invoice, payable, accounting and reconciliation
```

## 2. Rate and cost vocabulary
| Item | Canonical meaning | Exclusion |
|---|---|---|
| CarrierBuyRate | Source-asserted eligible carrier transport unit rate or fixed amount with terms | Customer sell tariff |
| TariffRuleSnapshot | Immutable version of rate logic, validity and contract reference | Legal regulatory/tax rule |
| CostEstimate | Provisional operational estimate with line items, assumptions and uncertainty | ERP posted actual |
| AccessorialEstimate | Fuel, toll, waiting, handling, demurrage etc. with clear source/type | Automatically payable liability |
| FreightCostActualReference | Source ERP/vendor invoice cost observation and matching evidence | Independent TMS GL |
| ScenarioQuoteComparison | Relative carrier/route operational buy-cost comparisons | Buyer quotation and approval |
| CostReconciliation | Difference between estimate and observed ERP/carrier actual | Reposting of ERP financial balances |

## 3. Computation invariants
- A calculation pins route revision, consignment/cargo quantities, rate source, provider contractual authority, mode, unit/FX rate source, FX observation time, validity and algorithm version. Never use binary float for money.
- Separate charge basis: per trip, kilometre, tonne, tonne-km, pallet, container/TEU, chargeable weight, dimensional weight, day, hour, stop or contract unit. Verify units before multiplication.
- Accessorials distinguish anticipated, incurred, disputed, approved and final; they may not simply inflate a customer's invoice.
- Currency conversion is explicit and auditable; if a reliable FX observation is unavailable, block cross-currency comparison rather than silently use "1".
- Carrier discount, negotiated buy rate and tier configuration are privileged trade secrets. Never show customer/another carrier a confidential cost breakdown.
- Quote version validity is different from shipment plan validity. A new plan/route may invalidate a buy estimate without rewriting the historical rate.
- Tax and duties obey governing external tax/regulatory logic and ERP/Payments ownership; TMS does not claim VAT/customs calculators.
- Deferred detention/demurrage is explicitly estimated until authoritative events and contractual triggers are available.

## 4. Commercial decision boundary
TMS MAY propose cheapest feasible carrier or optimised transport *based on declared cost assumptions*, but does not automatically select a carrier in violation of entitlement, insurance, capacity, route legality or SLA. Trade independently decides customer price and acceptance. ERP matches the contract/actual provider bill and owns accounting, disputes and payment obligations.

For Thamani, customer shipping prices must not accidentally become TMS canonical cost fields. For ZuriBeans, export B2B finance documents must cite the proper ERP/Trade commercial amount, not an internal TMS estimate.

## 5. APIs and events
Potential ports: `CarrierTariffReadPort`, `EstimateCostPort`, `ExternalFxObservationPort`, `ERPActualReferencePort`. Proposed actions: version tariff, estimate plan cost, compare offers, record accessorial observation, reconcile estimated vs actual. Material historical estimates are immutable versions with effective_at/recorded_at and provenance. No proposed event or canonical capability is executable until Shared governance approves it.

## 6. Implementation gates
| Gate | Evidence |
|---|---|
| TMS-COST-01 | Rate/cost schema, source/version provenance, currency precision and unit tests |
| TMS-COST-02 | Road freight weight/volume/trip/stop/accessorial scenario fixtures and deterministic output |
| TMS-COST-03 | Confidential rate access policy, tenant isolation, maker/checker rate approval |
| TMS-COST-04 | Trade sell-price isolation and ERP invoice/actual reconciliation contract tests |
| TMS-COST-05 | Stale FX, missing tariffs, route revision, disputed accessorial, duplicate observation and replay tests |
| TMS-COST-06 | Live provider offer/ERP statement validation before any production buy-cost claims |

Neither tariff accuracy nor actual profitability is certified by passing unit tests. Cost estimation can remain unavailable without blocking core TMS physical event processing when the user has not requested a costed service.

## 7. Rejected shortcuts and governance

Do not reuse an unrelated engine's authoritative database, mint globally authoritative organisations, substitute a vendor tracking ID for a Baobab canonical object, hard-code an estate/market, publish unregistered capability or event keys, or call a simulated/synthetic operation production-ready. Changes affecting another owner must first be reconciled in **baobab-platform/shared** and the relevant owning engine. Approval of this ADR is not evidence of runtime fitness, certification or deployment.

## 8. Decision follow-up

Implement in separate gate-scoped PRs. Maintain a conformance matrix linking each normative rule to code, tests, contract fixtures and open limitations. Any key or API name in this ADR is **illustrative**, not automatically part of the canonical capability catalogue. Keep ADR-TMS-0001/0002 and accepted Shared authority in force; explain and obtain approval for any needed supersession.
