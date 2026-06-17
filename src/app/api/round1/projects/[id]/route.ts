import { NextResponse } from "next/server";
import { round1Repository } from "@/server/round1/round1-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await round1Repository.getProject(id);

  if (!project) {
    return NextResponse.json(
      { error: "Round 1 project not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ project });
}
