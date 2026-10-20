import { NextResponse, type NextRequest } from "next/server";
import { handleAuthProxyRequest, NEON_AUTH_SESSION_COOKIE_NAME } from "@neondatabase/auth/server";
import { decideAccess, type SessionProbe } from "@/lib/auth/access";
import { usesNeon } from "@/lib/neon/config";

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

/**
 * Résout la session dans le proxy. `auth.getSession()` ne peut pas écrire de
 * cookie ici (next/headers est en lecture seule) : le renouvellement du cache
 * `session_data` était perdu et chaque navigation retombait sur l'amont. On
 * passe donc par le gestionnaire officiel et on recopie ses Set-Cookie.
 */
async function probeSession(request: NextRequest): Promise<{ probe: SessionProbe; cookies: string[] }> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (!cookieHeader.includes(NEON_AUTH_SESSION_COOKIE_NAME)) return { probe: { kind: "anonymous" }, cookies: [] };
  if (!baseUrl || !cookieSecret) return { probe: { kind: "unknown" }, cookies: [] };
  try {
    const headers = new Headers(request.headers);
    ["content-type", "content-length", "transfer-encoding"].forEach((name) => headers.delete(name));
    const response = await handleAuthProxyRequest({
      request: new Request(request.url, { method: "GET", headers }),
      path: "get-session",
      baseUrl,
      cookieSecret,
    });
    const cookies = response.headers.getSetCookie();
    if (!response.ok) return { probe: { kind: "unknown" }, cookies };
    const body = (await response.json().catch(() => undefined)) as { user?: unknown } | null | undefined;
    if (body === undefined) return { probe: { kind: "unknown" }, cookies };
    return { probe: body?.user ? { kind: "authenticated" } : { kind: "anonymous" }, cookies };
  } catch {
    return { probe: { kind: "unknown" }, cookies: [] };
  }
}

function withCookies(response: NextResponse, cookies: string[]) {
  cookies.forEach((cookie) => response.headers.append("set-cookie", cookie));
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/auth");
  // Les endpoints officiels Neon Auth restent joignables avec ou sans session.
  if (pathname.startsWith("/api/auth") || !usesNeon) return NextResponse.next({ request });

  const { probe, cookies } = await probeSession(request);
  const decision = decideAccess(probe, isAuthPage);

  if (decision === "redirect_login") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.search = "";
    url.searchParams.set("next", pathname);
    return withCookies(NextResponse.redirect(url), cookies);
  }
  if (decision === "redirect_home") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return withCookies(NextResponse.redirect(url), cookies);
  }
  return withCookies(NextResponse.next({ request }), cookies);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|icon.svg|sw.js|manifest.webmanifest|favicon.ico).*)"],
};
