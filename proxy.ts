import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { usesNeon } from "@/lib/neon/config";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/auth");
  const isAuthApiRoute = pathname.startsWith("/api/auth");
  const response = NextResponse.next({ request });
  let authenticated = false;

  // Les endpoints officiels Neon Auth doivent rester joignables avec ou sans
  // session (get-session, token, sign-out, callbacks…).
  if (isAuthApiRoute) return response;

  if (usesNeon) {
    const { data } = await auth.getSession();
    authenticated = Boolean(data?.user);

    if (!authenticated && !isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (authenticated && isAuthPage) {
      const url = request.nextUrl.clone();
      // Le cookie d'onboarding est propre au navigateur et ne prouve jamais
      // qu'un compte Neon est nouveau. L'état métier est résolu côté DataProvider.
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|icon.svg|sw.js|manifest.webmanifest|favicon.ico).*)"],
};
