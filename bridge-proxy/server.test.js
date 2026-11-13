import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { createBridgeProxy } from "./server.js";

const env = {
  BUDGY_PROXY_SECRET: "fixture-proxy-key",
  BRIDGE_CLIENT_ID: "fixture-bridge-client",
  BRIDGE_CLIENT_SECRET: "fixture-bridge-secret",
};
const auth = { "x-budgy-proxy-secret": env.BUDGY_PROXY_SECRET };
const bearer = { ...auth, authorization: "Bearer user-token" };
const catalog = "/v3/providers?country_code=FR&capabilities=aggregation&aggregation_release_status=active&limit=500";
const aggregation = "/v3/aggregation";
const identity = { external_user_id: `budgy-${"a".repeat(64)}` };

async function launch(t, request, config = {}) {
  const server = createBridgeProxy({ env, request, ...config });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  return (path, init) => fetch(`http://127.0.0.1:${server.address().port}${path}`, init);
}

const unreachable = () => assert.fail("Unexpected upstream request");

test("health is public and a missing or incorrect secret fails closed", async (t) => {
  const request = t.mock.fn(unreachable);
  const call = await launch(t, request);
  const health = await call("/health");
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });
  for (const headers of [{}, { "x-budgy-proxy-secret": "wrong" }]) {
    assert.equal((await call(catalog, { headers })).status, 401);
  }
  const unconfigured = await launch(t, request, { env: {} });
  assert.equal((await unconfigured(catalog, { headers: auth })).status, 401);
  assert.equal(request.mock.callCount(), 0);
});

test("restricts methods, paths, query parameters and request bodies before making any upstream call", async (t) => {
  const request = t.mock.fn(unreachable);
  const call = await launch(t, request);
  const json = { ...auth, "content-type": "application/json" };
  for (const path of ["/https://other.example", "//other.example/v3/providers", "/v3/payment-requests",
    "/v3/aggregation/items/1%2F..%2F..%2Fusers", "/v3/aggregation/items/01"]) {
    assert.equal((await call(path, { headers: auth })).status, 404);
  }
  assert.equal((await call(catalog, { method: "DELETE", headers: auth })).status, 404);
  assert.equal((await call(`${catalog}&url=https://other.example`, { headers: auth })).status, 400);
  assert.equal((await call(`${catalog}&country_code=GB`, { headers: auth })).status, 400);
  assert.equal((await call(`${aggregation}/transactions?limit=500`, { headers: bearer })).status, 400);
  assert.equal((await call(`${aggregation}/items/1`, { headers: auth })).status, 401);
  for (const [body, status] of [["{", 400], [JSON.stringify({ ...identity, url: "https://other.example" }), 400], ["x".repeat(9000), 413]]) {
    assert.equal((await call(`${aggregation}/users`, { method: "POST", headers: json, body })).status, status);
  }
  assert.equal(request.mock.callCount(), 0);
});

test("forwards only approved Bridge operations and adds credentials server-side", async (t) => {
  const request = t.mock.fn(async (target, init) => {
    assert.equal(target.origin, "https://api.bridgeapi.io");
    assert.equal(init.redirect, "manual");
    const headers = new Headers(init.headers);
    assert.equal(headers.get("bridge-version"), "2025-01-15");
    assert.equal(headers.get("client-id"), env.BRIDGE_CLIENT_ID);
    assert.equal(headers.get("client-secret"), env.BRIDGE_CLIENT_SECRET);
    assert.equal(headers.has("cookie"), false);
    assert.equal(headers.has("x-budgy-proxy-secret"), false);
    if (target.pathname === "/v3/providers") assert.equal(headers.has("authorization"), false);
    if (target.pathname.endsWith("/items/7") || target.pathname.endsWith("connect-sessions")) {
      assert.equal(headers.get("authorization"), "Bearer user-token");
    }
    if (init.method === "DELETE") return new Response(null, { status: 204 });
    if (init.method === "POST") {
      const body = JSON.parse(init.body);
      if (target.pathname.endsWith("/users")) {
        return Response.json({ uuid: "bridge-user", ...body, metadata: "private" }, { status: 201 });
      }
      if (target.pathname.endsWith("/authorization/token")) {
        return Response.json({ access_token: "user-token", expires_at: "2099-01-01T00:00:00Z",
          user: { uuid: "bridge-user", ...body, metadata: "private" }, metadata: "private" }, { status: 201 });
      }
      assert.match(body.callback_url, /^https:\/\/budgy-iota-green\.vercel\.app\/api\/banking\/callback/);
      return Response.json({ url: "https://connect.bridgeapi.io/session/fixture", metadata: "private" }, { status: 201 });
    }
    return Response.json({ resources: [], pagination: { next_uri: null } });
  });
  const call = await launch(t, request);
  const list = await call(catalog, { headers: { ...bearer, cookie: "not-forwarded", "client-secret": "caller-value" } });
  assert.equal(list.status, 200);
  assert.deepEqual(await list.json(), { resources: [], pagination: { next_uri: null } });
  assert.equal(list.headers.get("cache-control"), "no-store");
  const context = "b".repeat(64);
  const callback_url = `https://budgy-iota-green.vercel.app/api/banking/callback?state=${context}`;
  const consent = { context, callback_url, account_types: "payment", allow_account_selection: true };
  const user = { uuid: "bridge-user", ...identity };
  const session = { url: "https://connect.bridgeapi.io/session/fixture" };
  for (const [path, body, result] of [
    ["/users", identity, user],
    ["/authorization/token", identity, { access_token: "user-token", expires_at: "2099-01-01T00:00:00Z", user }],
    ["/connect-sessions", { ...consent, provider_id: 5, user_email: "fixture@example.test" }, session],
    ["/connect-sessions", { ...consent, item_id: 7, force_reauthentication: true }, session],
  ]) {
    const response = await call(`${aggregation}${path}`, {
      method: "POST", headers: { ...bearer, "content-type": "application/json" }, body: JSON.stringify(body),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), result);
  }
  for (const path of ["/accounts?item_id=7&after=abc", "/transactions?account_id=9&after=xyz", "/items/7"]) {
    assert.equal((await call(`${aggregation}${path}`, { headers: bearer })).status, 200);
  }
  assert.equal((await call(`${aggregation}/items/7`, { method: "DELETE", headers: bearer })).status, 204);
  assert.equal(request.mock.callCount(), 9);
});

test("sanitizes Bridge errors and rejects redirects and leaked credentials", async (t) => {
  let upstream = () => new Response(null, { status: 302, headers: { location: "https://other.example/" } });
  const request = t.mock.fn(() => upstream());
  const call = await launch(t, request);
  const redirect = await call(catalog, { headers: auth });
  assert.equal(redirect.status, 502);
  assert.equal(redirect.headers.get("location"), null);
  assert.equal(request.mock.callCount(), 1);

  upstream = () => Response.json({ credentials: env.BRIDGE_CLIENT_SECRET });
  const leak = await call(catalog, { headers: auth });
  assert.equal(leak.status, 502);
  assert.equal((await leak.text()).includes(env.BRIDGE_CLIENT_SECRET), false);

  upstream = () => Response.json({ errors: [null, {
    code: "user.authentication.unauthorized", message: env.BRIDGE_CLIENT_SECRET,
  }] }, { status: 401, headers: { "set-cookie": "sensitive" } });
  const unauthorized = await call(`${aggregation}/authorization/token`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(identity),
  });
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers.get("set-cookie"), null);
  assert.deepEqual(await unauthorized.json(), { errors: [{ code: "user.authentication.unauthorized" }] });

  upstream = () => Response.json({ message: env.BRIDGE_CLIENT_SECRET }, { status: 429 });
  const limited = await call(catalog, { headers: auth });
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: "bridge_request_failed" });
});

test("returns 504 when the Bridge timeout elapses", async (t) => {
  const call = await launch(t, (_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }), { timeoutMs: 20 });
  const response = await call(catalog, { headers: auth });
  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), { error: "bridge_unavailable" });
});
