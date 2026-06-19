import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/platform/auth-service";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
