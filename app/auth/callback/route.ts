import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") || "/";
  const url = request.nextUrl.clone();
  url.pathname = next.startsWith("/") ? next : "/";
  url.search = "";
  return NextResponse.redirect(url);
}
