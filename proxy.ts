import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { usesNeon } from "@/lib/neon/config";

const ONBOARDING_COOKIE = "budgy_onboarding_done";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/auth") || pathname.startsWith("/api/auth");
  const isOnboardingRoute = pathname === "/onboarding";
  const onboardingDone = request.cookies.get(ONBOARDING_COOKIE)?.value === "1";
  const response = NextResponse.next({ request });
  let authenticated = false;

  if (usesNeon) {
    const { data } = await auth.getSession();
    authenticated = Boolean(data?.user);

    if (!authenticated && !isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (authenticated && isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = onboardingDone ? "/" : "/onboarding";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (!isAuthRoute && !isOnboardingRoute && !onboardingDone) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|icon.svg|sw.js|manifest.webmanifest|favicon.ico).*)"],
};
