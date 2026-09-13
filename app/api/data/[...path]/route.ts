import { auth } from "@/lib/auth/server";

type RouteContext = { params: Promise<{ path: string[] }> };

const accessToken = async () => {
  const result = await auth.token();
  const data = result.data as { token?: string } | null;
  return data?.token ?? null;
};

async function forward(request: Request, context: RouteContext) {
  const baseUrl = process.env.NEON_DATA_API_URL?.replace(/\/$/, "");
  if (!baseUrl) return Response.json({ message: "NEON_DATA_API_URL is missing." }, { status: 503 });
  const token = await accessToken();
  if (!token) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const { path } = await context.params;
  const incoming = new URL(request.url);
  const target = `${baseUrl}/${path.map(encodeURIComponent).join("/")}${incoming.search}`;
  const headers = new Headers();
  headers.set("authorization", `Bearer ${token}`);
  for (const name of ["accept", "content-type", "prefer", "range", "range-unit"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const response = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
  });
  const outgoing = new Headers();
  for (const name of ["content-type", "content-range", "preference-applied", "location"]) {
    const value = response.headers.get(name);
    if (value) outgoing.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers: outgoing });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
