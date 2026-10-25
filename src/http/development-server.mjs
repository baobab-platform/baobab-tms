/**
 * Local-only skeleton probe. This is not an authenticated TMS API.
 * Deliberately exposes NO shipment, booking, driver, carrier or provider
 * endpoints. NODE_ENV=production fails closed until qualified adapters land.
 */
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

export function createDevelopmentServer() {
  return createServer((request, response) => {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (request.method === "GET" && request.url === "/livez") {
      response.writeHead(200);
      response.end(JSON.stringify({ status: "LIVE", service: "baobab-tms", mode: "foundation-only" }));
      return;
    }
    if (request.method === "GET" && request.url === "/readyz") {
      response.writeHead(503);
      response.end(JSON.stringify({
        status: "NOT_READY",
        reasons: ["IAM_CP_AUTHORITY_UNWIRED", "CANONICAL_CONTRACTS_UNREGISTERED", "NATIVE_PROVIDERS_UNQUALIFIED"]
      }));
      return;
    }
    response.writeHead(404);
    response.end(JSON.stringify({ error: "NOT_IMPLEMENTED" }));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("FND-01 probe must not run in production");
  }
  const port = Number(process.env.TMS_DEV_PORT ?? 4080);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid TMS_DEV_PORT");
  }
  createDevelopmentServer().listen(port, "127.0.0.1", () => {
    process.stdout.write("TMS foundation liveness on 127.0.0.1:" + port + "\n");
  });
}
