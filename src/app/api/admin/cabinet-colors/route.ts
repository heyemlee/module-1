import { NextResponse } from "next/server";
import { z } from "zod";
import { ForbiddenError, requireRole, requireUser, UnauthorizedError } from "@/server/platform/auth-service";
import { cabinetColorInputSchema, createCabinetColor, listCabinetColors } from "@/server/platform/cabinet-color-repository";

export function parseCabinetColorRequest(value: unknown) {
  return cabinetColorInputSchema.parse(value);
}

function authError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    return NextResponse.json({ colors: await listCabinetColors(user.companyId, false) });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Unable to list cabinet colors" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    const input = parseCabinetColorRequest(await request.json());
    return NextResponse.json({ color: await createCabinetColor(user.companyId, input) }, { status: 201 });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid cabinet color request", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create cabinet color" }, { status: 500 });
  }
}
