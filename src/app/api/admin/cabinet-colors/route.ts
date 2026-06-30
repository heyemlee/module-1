import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireUser } from "@/server/platform/auth-service";
import { createCabinetColor, listCabinetColors } from "@/server/platform/cabinet-color-repository";
import { authErrorResponse, serverError } from "@/server/platform/api-errors";
import { parseCabinetColorRequest } from "./validation";

export async function GET() {
  try {
    const user = await requireUser();
    requireRole(user, ["OWNER"]);
    return NextResponse.json({ colors: await listCabinetColors(user.companyId, false) });
  } catch (error) {
    return authErrorResponse(error, "Admins only") ?? serverError("admin/cabinet-colors:list", error, "Unable to list cabinet colors");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    requireRole(user, ["OWNER"]);
    const input = parseCabinetColorRequest(await request.json());
    return NextResponse.json({ color: await createCabinetColor(user.companyId, input) }, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error, "Admins only");
    if (auth) return auth;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid cabinet color request", issues: error.issues }, { status: 400 });
    }
    return serverError("admin/cabinet-colors:create", error, "Unable to create cabinet color");
  }
}
