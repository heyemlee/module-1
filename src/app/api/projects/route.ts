import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/platform/auth-service";
import { authErrorResponse } from "@/server/platform/api-errors";
import { createCustomerProject, listProjectsForUser } from "@/server/platform/project-repository";

const createSchema = z.object({
  customerName: z.string().trim().min(1),
  customerPhone: z.string().trim().optional(),
  customerEmail: z.string().trim().email().optional(),
  customerAddress: z.string().trim().optional(),
  projectName: z.string().trim().min(1)
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const projects = await listProjectsForUser(user, searchParams.get("q") ?? "");
    return NextResponse.json({ projects });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unable to list projects" }, { status: 500 })
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = createSchema.parse(await request.json());
    const project = await createCustomerProject({
      user,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      customerAddress: input.customerAddress,
      projectName: input.projectName
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid project request", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Unable to create project" }, { status: 500 });
  }
}
