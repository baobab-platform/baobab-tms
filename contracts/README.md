# Baobab TMS Contract Consumption

The only authoritative canonical capability/event/identity definitions live in
[baobab-platform/shared](https://github.com/baobab-platform/shared).

At FND-01 no new logistics capability is registered in Shared's catalogue,
and the engine has no active event producer. The existing Trade-owned
\`contracts/shipment/v1\` and \`trade.shipment\` event types are not copied,
redefined or taken over. The local
\`.baobab/capability-provider.yaml\` lists CANDIDATE planned intent ONLY,
as permitted by ADR-SHARED-017. No \`providers\` are declared.

Before any public API, consumer or producer is activated, pin the exact Shared
contract revision, validate generated bindings/schema, add compatibility tests,
obtain a new Shared decision where necessary, and separately qualify the
runtime with Control Plane and IAM. ADR acceptance alone is not a wire contract.
