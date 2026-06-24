import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/platform/auth-service";
import { cabinetColorInputSchema, updateCabinetColor } from "@/server/platform/cabinet-color-repository";
import { authErrorResponse, serverError } from "@/server/platform/api-errors";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ colorId: string }> }
) {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    const { colorId } = await params;
    const input = cabinetColorInputSchema.parse(await request.json());
    const color = await updateCabinetColor(user.companyId, colorId, input);
    if (!color) return NextResponse.json({ error: "Cabinet color not found" }, { status: 404 });
    return NextResponse.json({ color });
  } catch (error) {
    const auth = authErrorResponse(error, "Admins only");
    if (auth) return auth;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid cabinet color request", issues: error.issues }, { status: 400 });
    }
    return serverError("admin/cabinet-color:update", error, "Unable to update cabinet color");
  }
}
