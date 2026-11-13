import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const BRIDGE_ORIGIN = "https://api.bridgeapi.io";
const BRIDGE_VERSION = "2025-01-15";
const MAX_BODY_BYTES = 8_192;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 8_000;
const itemPath = /^\/v3\/aggregation\/items\/[1-9]\d{0,15}$/;
const aggregation = "/v3/aggregation";
const positiveId = /^[1-9]\d{0,15}$/;
const pagination = { limit: /^(?:[1-9]\d?|[1-4]\d{2}|500)$/, after: /^[\x21-\x7e]{1,2048}$/ };
const providerFields = ["id", "name", "country_code", "capabilities"];
const userFields = ["uuid", "external_user_id"];
const itemFields = ["id", "provider_id", "status", "authentication_expires_at", "created_at"];
const accountFields = ["id", "item_id", "provider_id", "name", "currency_code", "balance",
  "accounting_balance", "type", "iban", "data_access"];
const transactionFields = ["id", "provider_external_id", "account_id", "amount", "currency_code",
  "date", "booking_date", "value_date", "clean_description", "provider_description",
  "future", "deleted", "category_id"];

const allowed = new Map([
  ["GET /v3/providers", { query: {
    ...pagination, country_code: /^[A-Z]{2}$/, capabilities: /^aggregation$/, aggregation_release_status: /^active$/,
  }, required: ["country_code", "capabilities", "aggregation_release_status"], fields: providerFields }],
  [`POST ${aggregation}/users`, { body: "identity", select: (data) => pick(data, userFields) }],
  [`POST ${aggregation}/authorization/token`, { body: "identity", select: tokenResponse }],
  [`POST ${aggregation}/connect-sessions`, { body: "consent", bearer: true, select: (data) => pick(data, ["url"]) }],
  [`GET ${aggregation}/accounts`, { query: { ...pagination, item_id: positiveId }, required: ["item_id"], bearer: true, fields: accountFields }],
  [`GET ${aggregation}/transactions`, { query: { ...pagination, account_id: positiveId }, required: ["account_id"], bearer: true, fields: transactionFields }],
]);
const forwardedErrors = new Set([400, 401, 403, 404, 409, 422, 429]);

class RequestError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function send(res, status, data) {
  res.writeHead(status, {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...(data === undefined ? {} : { "content-type": "application/json; charset=utf-8" }),
  });
  res.end(data === undefined ? undefined : JSON.stringify(data));
}

function digest(value) {
  return createHash("sha256").update(value).digest();
}

function targetFor(req) {
  const raw = req.url ?? "";
  const [path] = raw.split("?", 1);
  const route = allowed.get(`${req.method} ${path}`) ??
    (itemPath.test(path) && ["GET", "DELETE"].includes(req.method) ? { bearer: true, select: (data) => pick(data, itemFields) } : undefined);
  if (!route) throw new RequestError(404, "not_found");

  const incoming = new URL(raw, BRIDGE_ORIGIN);
  const target = new URL(path, BRIDGE_ORIGIN);
  const query = route.query ?? {};
  for (const [name, value] of incoming.searchParams) {
    if (!Object.hasOwn(query, name) || !query[name].test(value) || target.searchParams.has(name)) {
      throw new RequestError(400, "invalid_query");
    }
    target.searchParams.set(name, value);
  }
  if (route.required?.some((name) => !target.searchParams.has(name))) {
    throw new RequestError(400, "invalid_query");
  }
  return { route, target };
}

async function readJson(chunks, limit, status, code) {
  let size = 0;
  const body = [];
  for await (const chunk of chunks) {
    size += chunk.length;
    if (size > limit) throw new RequestError(status, code);
    body.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(body).toString("utf8"));
  } catch {
    throw new RequestError(status === 413 ? 400 : 502, "invalid_json");
  }
}

function validId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validCallback(value, context) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const allowedProtocol = url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
    return allowedProtocol && !url.username && !url.password && !url.hash &&
      url.pathname === "/api/banking/callback" && url.search === `?state=${context}`;
  } catch {
    return false;
  }
}

function validBody(body, type) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  if (type === "identity") {
    return Object.keys(body).length === 1 && typeof body.external_user_id === "string" &&
      /^budgy-[a-f0-9]{64}$/.test(body.external_user_id);
  }
  const common = ["callback_url", "context", "account_types", "allow_account_selection"];
  const renewal = Object.hasOwn(body, "item_id");
  const keys = [...common, ...(renewal ? ["item_id", "force_reauthentication"] : ["provider_id", "user_email"])];
  return Object.keys(body).every((key) => keys.includes(key)) &&
    typeof body.context === "string" && /^[a-f0-9]{64}$/.test(body.context) &&
    validCallback(body.callback_url, body.context) && body.account_types === "payment" &&
    body.allow_account_selection === true &&
    (renewal ? validId(body.item_id) && body.force_reauthentication === true
      : validId(body.provider_id) && typeof body.user_email === "string" &&
        body.user_email.length <= 320 && /^[^\s@]+@[^\s@]+$/.test(body.user_email));
}

function pick(data, fields) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  return Object.fromEntries(fields.filter((field) => Object.hasOwn(data, field)).map((field) => [field, data[field]]));
}

function tokenResponse(data) {
  const token = pick(data, ["access_token", "expires_at", "user"]);
  if (token?.user) token.user = pick(token.user, userFields);
  return token;
}

function responseFor(route, data) {
  if (route.select) return route.select(data);
  const page = pick(data, ["resources", "pagination"]);
  if (Array.isArray(page?.resources)) page.resources = page.resources.map((row) => pick(row, route.fields));
  if (page?.pagination) page.pagination = pick(page.pagination, ["next_uri"]);
  return page;
}

function upstreamHeaders(req, route, clientId, clientSecret) {
  const headers = {
    "bridge-version": BRIDGE_VERSION,
    "client-id": clientId,
    "client-secret": clientSecret,
    accept: "application/json",
  };
  if (route.bearer) {
    const authorization = req.headers.authorization;
    if (typeof authorization !== "string" || !/^Bearer [!-~]{1,4096}$/.test(authorization)) {
      throw new RequestError(401, "unauthorized");
    }
    headers.authorization = authorization;
  }
  if (route.body) headers["content-type"] = "application/json";
  return headers;
}

export function createBridgeProxy({
  env = process.env,
  request = fetch,
  timeoutMs = UPSTREAM_TIMEOUT_MS,
} = {}) {
  const proxySecret = env.BUDGY_PROXY_SECRET?.trim();
  const expectedSecret = proxySecret ? digest(proxySecret) : null;
  const clientId = env.BRIDGE_CLIENT_ID?.trim();
  const clientSecret = env.BRIDGE_CLIENT_SECRET?.trim();

  return createServer({ requestTimeout: 15_000, headersTimeout: 10_000 }, async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      send(res, 200, { ok: true });
      return;
    }

    const candidate = req.headers["x-budgy-proxy-secret"];
    if (!expectedSecret || typeof candidate !== "string" || !timingSafeEqual(expectedSecret, digest(candidate))) {
      send(res, 401, { error: "unauthorized" });
      return;
    }

    try {
      const { route, target } = targetFor(req);
      if (!clientId || !clientSecret) throw new RequestError(503, "proxy_unavailable");
      const headers = upstreamHeaders(req, route, clientId, clientSecret);
      let body;
      if (route.body) {
        if (req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") {
          throw new RequestError(415, "unsupported_media_type");
        }
        const parsed = await readJson(req.iterator({ destroyOnReturn: false }), MAX_BODY_BYTES, 413, "body_too_large");
        if (!validBody(parsed, route.body)) throw new RequestError(400, "invalid_body");
        body = JSON.stringify(parsed);
      }

      const signal = AbortSignal.timeout(timeoutMs);
      try {
        const upstream = await request(target, { method: req.method, headers, body, redirect: "manual", signal });
        if (upstream.status === 204) {
          send(res, 204);
          return;
        }
        if (!upstream.ok) {
          const status = forwardedErrors.has(upstream.status) ? upstream.status : 502;
          // The provider uses this exact code to provision a missing Bridge user.
          if (target.pathname === `${aggregation}/authorization/token` && status === 401 && upstream.body) {
            const payload = await readJson(upstream.body, MAX_RESPONSE_BYTES, 502, "bridge_unavailable")
              .catch((error) => {
                if (signal.aborted) throw error;
                return null;
              });
            if (Array.isArray(payload?.errors) && payload.errors.some((entry) => entry?.code === "user.authentication.unauthorized")) {
              send(res, status, { errors: [{ code: "user.authentication.unauthorized" }] });
              return;
            }
          } else {
            await upstream.body?.cancel().catch(() => undefined);
          }
          send(res, status, { error: "bridge_request_failed" });
          return;
        }

        if (!upstream.body) throw new RequestError(502, "bridge_unavailable");
        const data = await readJson(upstream.body, MAX_RESPONSE_BYTES, 502, "bridge_unavailable");
        const json = JSON.stringify(data);
        if ([proxySecret, clientId, clientSecret].some((secret) => json.includes(JSON.stringify(secret).slice(1, -1)))) {
          throw new RequestError(502, "bridge_unavailable");
        }
        send(res, upstream.status, responseFor(route, data));
      } catch {
        send(res, signal.aborted ? 504 : 502, { error: "bridge_unavailable" });
      }
    } catch (error) {
      if (error instanceof RequestError) {
        if (error.status === 413) res.setHeader("connection", "close");
        send(res, error.status, { error: error.code });
      } else {
        send(res, 500, { error: "proxy_unavailable" });
      }
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 10_000);
  createBridgeProxy().listen(port, "0.0.0.0");
}
