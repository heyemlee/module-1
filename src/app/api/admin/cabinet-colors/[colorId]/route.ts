import { NextResponse } from "next/server";
import { z } from "zod";
import { ForbiddenError, requireRole, requireUser, UnauthorizedError } from "@/server/platform/auth-service";
import { cabinetColorInputSchema, updateCabinetColor } from "@/server/platform/cabinet-color-repository";
import { serverError } from "@/server/platform/api-errors";

function authError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  return null;
}

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
    const auth = authError(error);
    if (auth) return auth;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid cabinet color request", issues: error.issues }, { status: 400 });
    }
    return serverError("admin/cabinet-color:update", error, "Unable to update cabinet color");
  }
}
