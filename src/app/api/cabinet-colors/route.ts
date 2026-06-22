import { NextResponse } from "next/server";
import { requireUser } from "@/server/platform/auth-service";
import { listCabinetColors } from "@/server/platform/cabinet-color-repository";

export async function GET() {
  const user = await requireUser();
  return NextResponse.json({
    colors: await listCabinetColors(user.companyId, true)
  });
}
