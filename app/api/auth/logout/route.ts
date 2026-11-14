import { NextResponse } from "next/server";
import { SESSION_COOKIE, appUrl } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.redirect(`${appUrl()}/login`, { status: 303 });
  res.cookies.delete({ name: SESSION_COOKIE, path: "/" });
  return res;
}
