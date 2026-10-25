/**
 * Pure canonical-domain foundation for ADR-TMS-0001/0002.
 *
 * IMPORTANT: No function in this module authenticates a caller or redeems
 * CP context. Only an authenticated application adapter may supply verified
 * operating context. Do not expose these functions as HTTP commands until
 * IAM + CP verification, durable persistence and action-level policy land.
 *
 * TradeShipment, LogisticsShipment, Consignment and physical Movement are
 * deliberately distinct identities. No native Fleetbase/Open TMS ID may
 * become the canonical identity through this module.
 */

const positiveDecimal = /^(?:0*[1-9]\d*(?:\.\d+)?|0*\.\d*[1-9]\d*)$/;

/** Reject ambiguous identity and scope instead of filling default tenants. */
function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new TypeError(field + " must be an explicit nonempty canonical reference");
  }
  return value;
}

function operatingScope(context) {
  if (context === null || typeof context !== "object" || Array.isArray(context)) {
    throw new TypeError("Verified operating context required");
  }
  return {
    tenantId: requiredText(context.tenantId, "tenantId"),
    operatingOrganisationId: requiredText(context.operatingOrganisationId, "operatingOrganisationId"),
    legalEntityId: requiredText(context.legalEntityId, "legalEntityId"),
    marketId: requiredText(context.marketId, "marketId")
  };
}

function frozen(value) {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(frozen));
  }
  if (value !== null && typeof value === "object") {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, frozen(item)])
    ));
  }
  return value;
}

function sourceRequirements(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new TypeError("At least one source requirement is required");
  }
  const identities = new Set();
  return sources.map((source) => {
    const type = requiredText(source?.sourceType, "sourceType");
    const ref = requiredText(source?.sourceReference, "sourceReference");
    const key = type + "\u0000" + ref;
    if (identities.has(key)) throw new TypeError("Duplicate source requirement");
    identities.add(key);
    return { sourceType: type, sourceReference: ref };
  });
}

function cargoItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new TypeError("At least one cargo item is required");
  }
  const identities = new Set();
  return items.map((item) => {
    const cargoItemId = requiredText(item?.cargoItemId, "cargoItemId");
    const description = requiredText(item?.description, "description");
    const quantity = requiredText(item?.quantity, "quantity");
    const unit = requiredText(item?.unitOfMeasure, "unitOfMeasure");
    if (!positiveDecimal.test(quantity)) {
      throw new TypeError("Cargo quantity must be a positive decimal string (not a float)");
    }
    if (identities.has(cargoItemId)) throw new TypeError("Duplicate cargoItemId");
    identities.add(cargoItemId);
    // Source description is a shipment-specific snapshot, not Product master.
    return { cargoItemId, description, quantity, unitOfMeasure: unit };
  });
}

/** A DRAFT is not a transport booking, confirmed capacity or movement fact. */
export function createShipmentDraft({ shipmentId, context, sources, cargo }) {
  return frozen({
    kind: "LogisticsShipment",
    shipmentId: requiredText(shipmentId, "shipmentId"),
    context: operatingScope(context),
    sources: sourceRequirements(sources),
    cargo: cargoItems(cargo),
    state: "DRAFT",
    aggregateVersion: 1
  });
}

/** Consignment identity survives rebooking; it is not a booking itself. */
export function createConsignmentDraft({ consignmentId, context, consignorReference, consigneeReference }) {
  return frozen({
    kind: "Consignment",
    consignmentId: requiredText(consignmentId, "consignmentId"),
    context: operatingScope(context),
    consignorReference: requiredText(consignorReference, "consignorReference"),
    consigneeReference: requiredText(consigneeReference, "consigneeReference"),
    state: "DRAFT",
    aggregateVersion: 1
  });
}

/**
 * Explicit many-to-many allocation. Persistent implementation MUST additionally
 * enforce scope under transactional, concurrent, CP-authorised commands.
 * This model does not reserve carrier capacity or assert physical custody.
 */
export function associateConsignment(shipment, consignment, cargoItemIds) {
  if (shipment?.kind !== "LogisticsShipment" || consignment?.kind !== "Consignment") {
    throw new TypeError("Distinct LogisticsShipment and Consignment required");
  }
  for (const field of ["tenantId", "operatingOrganisationId", "legalEntityId", "marketId"]) {
    if (shipment.context[field] !== consignment.context[field]) {
      throw new Error("SCOPE_MISMATCH: " + field);
    }
  }
  if (!Array.isArray(cargoItemIds) || cargoItemIds.length === 0) {
    throw new TypeError("Association must identify real cargo scope");
  }
  const allowed = new Set(shipment.cargo.map((item) => item.cargoItemId));
  if (new Set(cargoItemIds).size !== cargoItemIds.length ||
      cargoItemIds.some((id) => !allowed.has(id))) {
    throw new Error("INVALID_CARGO_SCOPE");
  }
  return frozen({
    kind: "ShipmentConsignmentAssociation",
    shipmentId: shipment.shipmentId,
    consignmentId: consignment.consignmentId,
    context: shipment.context,
    cargoItemIds
  });
}
