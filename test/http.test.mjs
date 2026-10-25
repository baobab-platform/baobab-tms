import test from "node:test";
import assert from "node:assert/strict";
import { createDevelopmentServer } from "../src/http/development-server.mjs";

test("only liveness succeeds; readiness fails and no business API is exposed", async () => {
  const server = createDevelopmentServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const origin = "http://127.0.0.1:" + address.port;
  try {
    const live = await fetch(origin + "/livez");
    assert.equal(live.status, 200);
    assert.equal((await live.json()).mode, "foundation-only");
    const ready = await fetch(origin + "/readyz");
    assert.equal(ready.status, 503);
    assert.equal((await ready.json()).status, "NOT_READY");
    for (const route of ["/v1/shipments", "/v1/bookings", "/v1/providers"]) {
      const denied = await fetch(origin + route, { method: "POST" });
      assert.equal(denied.status, 404);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
});
