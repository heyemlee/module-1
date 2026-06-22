import { NextResponse } from "next/server";
import { requireUser } from "@/server/platform/auth-service";
import { authErrorResponse } from "@/server/platform/api-errors";
import { listCabinetColors } from "@/server/platform/cabinet-color-repository";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({
      colors: await listCabinetColors(user.companyId, true, {
        includeHoverExampleImages: false
      })
    });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unable to list cabinet colors" }, { status: 500 })
    );
  }
}
