import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { supabaseAnonKey, supabaseUrl, usesSupabase } from "@/lib/supabase/config";

const ONBOARDING_COOKIE = "budgy_onboarding_done";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/auth");
  const isOnboardingRoute = pathname === "/onboarding";
  const onboardingDone = request.cookies.get(ONBOARDING_COOKIE)?.value === "1";
  let response = NextResponse.next({ request });
  let authenticated = false;

  if (usesSupabase && supabaseUrl && supabaseAnonKey) {
    const client = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { data } = await client.auth.getUser();
    authenticated = Boolean(data.user);

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
  matcher: ["/((?!_next/static|_next/image|icon.svg|sw.js|manifest.webmanifest|favicon.ico).*)"],
};
