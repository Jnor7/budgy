import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") || "/";
  const client = await getSupabaseServerClient();
  if (code && client) await client.auth.exchangeCodeForSession(code);
  const url = request.nextUrl.clone();
  url.pathname = next.startsWith("/") ? next : "/";
  url.search = "";
  return NextResponse.redirect(url);
}
