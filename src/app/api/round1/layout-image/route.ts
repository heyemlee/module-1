import { NextResponse } from "next/server";
import { z } from "zod";
import { round1FormSchema } from "@/domain/round1";
import { createOpenAIImageAdapterFromEnv } from "@/infrastructure/image/openai-rest-image-client";
import { generateRound1LayoutImage } from "@/server/round1/layout-image-service";

const requestSchema = z.object({
  form: round1FormSchema
});

export async function POST(request: Request) {
  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid Round 1 layout image request", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Invalid Round 1 layout image request" },
      { status: 400 }
    );
  }

  const adapter = createOpenAIImageAdapterFromEnv(process.env);
  if (!adapter) {
    return NextResponse.json(
      {
        error: "OpenAI image generation is not configured",
        reason: "OPENAI_API_KEY_NOT_CONFIGURED"
      },
      { status: 503 }
    );
  }

  try {
    const image = await generateRound1LayoutImage({
      form: parsed.form,
      adapter
    });
    return NextResponse.json(image, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to generate Round 1 layout background",
        reason: error instanceof Error ? error.message : "UNKNOWN_ERROR"
      },
      { status: 502 }
    );
  }
}
