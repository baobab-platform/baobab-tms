import test from "node:test";
import assert from "node:assert/strict";
import {
  createShipmentDraft, createConsignmentDraft, associateConsignment
} from "../src/domain/shipment.mjs";

const scopeA = Object.freeze({
  tenantId: "tenant-a",
  operatingOrganisationId: "org-a",
  legalEntityId: "legal-a",
  marketId: "market-ug"
});
const scopeB = { ...scopeA, tenantId: "tenant-b" };
const source = [{ sourceType: "TradeShipment", sourceReference: "trade-a" }];
const cargo = [{ cargoItemId: "cargo-a", description: "Green coffee", quantity: "60.50", unitOfMeasure: "kg" }];
const makeShipment = (context = scopeA) => createShipmentDraft({
  shipmentId: "logistics-a", context, sources: source, cargo
});
const makeConsignment = (context = scopeA, id = "consignment-a") =>
  createConsignmentDraft({
    consignmentId: id, context, consignorReference: "org-supplier",
    consigneeReference: "org-buyer"
  });

test("shipment and consignment are distinct immutable draft aggregates", () => {
  const shipment = makeShipment();
  const consignment = makeConsignment();
  assert.equal(shipment.kind, "LogisticsShipment");
  assert.equal(consignment.kind, "Consignment");
  assert.equal(shipment.state, "DRAFT");
  assert.equal(consignment.state, "DRAFT");
  assert.equal(shipment.aggregateVersion, 1);
  assert.ok(Object.isFrozen(shipment.cargo[0]));
  assert.throws(() => { shipment.cargo[0].quantity = "100"; }, TypeError);
  assert.notEqual(shipment.shipmentId, consignment.consignmentId);
});

test("many-to-many associations retain explicit cargo scope", () => {
  const shipment = makeShipment();
  const first = associateConsignment(shipment, makeConsignment(), ["cargo-a"]);
  const second = associateConsignment(shipment, makeConsignment(scopeA, "consignment-b"), ["cargo-a"]);
  assert.equal(first.shipmentId, second.shipmentId);
  assert.notEqual(first.consignmentId, second.consignmentId);
  assert.deepEqual(first.cargoItemIds, ["cargo-a"]);
});

test("wrong-tenant, wrong-legal-entity and wrong-market allocations fail", () => {
  for (const foreignScope of [
    scopeB, { ...scopeA, legalEntityId: "legal-b" },
    { ...scopeA, marketId: "market-za" },
    { ...scopeA, operatingOrganisationId: "org-b" }
  ]) {
    assert.throws(() => associateConsignment(
      makeShipment(), makeConsignment(foreignScope), ["cargo-a"]
    ), /SCOPE_MISMATCH/);
  }
  assert.throws(() => associateConsignment(
    makeShipment(), makeConsignment(), ["unknown-cargo"]
  ), /INVALID_CARGO_SCOPE/);
});

test("no default tenant or unitless/float cargo is accepted", () => {
  assert.throws(() => makeShipment({ ...scopeA, tenantId: "" }), /tenantId/);
  assert.throws(() => createShipmentDraft({
    shipmentId: "one", context: scopeA, sources: source,
    cargo: [{ ...cargo[0], quantity: 50 }]
  }), /quantity/);
  assert.throws(() => createShipmentDraft({
    shipmentId: "one", context: scopeA, sources: source,
    cargo: [{ ...cargo[0], unitOfMeasure: "" }]
  }), /unitOfMeasure/);
  assert.throws(() => createShipmentDraft({
    shipmentId: "one", context: scopeA, sources: [...source, ...source], cargo
  }), /Duplicate source/);
});
