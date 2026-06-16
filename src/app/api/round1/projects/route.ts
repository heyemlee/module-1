import { NextResponse } from "next/server";
import { z } from "zod";
import { round1FormSchema } from "@/domain/round1";
import { round1Repository } from "@/server/round1/round1-repository";

const createProjectRequestSchema = z.object({
  customerName: z.string().trim().min(1),
  showroomForm: round1FormSchema.optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = createProjectRequestSchema.parse(body);
    const project = await round1Repository.createProject({
      customerName: input.customerName
    });
    const round1 = input.showroomForm
      ? await round1Repository.saveShowroomForm(project.id, input.showroomForm)
      : undefined;

    return NextResponse.json({ project, round1 }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid Round 1 project request",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Unable to create Round 1 project" },
      { status: 500 }
    );
  }
}
