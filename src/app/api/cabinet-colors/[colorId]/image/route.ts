import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/platform/auth-service";
import { authErrorResponse, serverError } from "@/server/platform/api-errors";
import { getCabinetColorImage } from "@/server/platform/cabinet-color-repository";

const variantSchema = z.enum(["swatch", "hover"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ colorId: string }> }
) {
  try {
    const user = await requireUser();
    const { colorId } = await params;
    const variant = variantSchema.safeParse(new URL(request.url).searchParams.get("variant"));
    if (!variant.success) {
      return NextResponse.json({ error: "Invalid image variant" }, { status: 400 });
    }

    const image = await getCabinetColorImage(user.companyId, colorId, variant.data);
    if (!image) return NextResponse.json({ error: "Cabinet color image not found" }, { status: 404 });

    return new NextResponse(new Uint8Array(image.body), {
      status: 200,
      headers: {
        "Content-Type": image.contentType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=31536000, immutable"
      }
    });
  } catch (error) {
    return authErrorResponse(error) ?? serverError("cabinet-color-image", error, "Unable to load cabinet color image");
  }
}
