import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/platform/auth-service";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
