import { NextResponse } from "next/server";
import { z } from "zod";
import { round1FormSchema } from "@/domain/round1";
import { runRound1AgentTurn } from "@/server/round1/agent-service";
import { LLMProviderNotConfiguredError } from "@/server/llm/provider";
import { requireUser } from "@/server/platform/auth-service";
import type { AuthUser } from "@/server/platform/types";
import { authErrorResponse, serverError } from "@/server/platform/api-errors";
import { rateLimit } from "@/server/platform/rate-limit";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(500),
  // The current live form is sent by the client and re-validated here. The agent
  // mutates a copy and returns the validated result; the server never trusts a
  // client-supplied snapshot and never reads/writes the repository here.
  form: round1FormSchema,
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000)
      })
    )
    .max(10)
    .optional()
});

export async function POST(request: Request) {
  // The agent drives a (potentially paid) LLM turn, so it must be authenticated —
  // it is only ever called from the authed Round 1 page.
  let user: AuthUser;
  try {
    user = await requireUser();
  } catch (error) {
    return authErrorResponse(error) ?? serverError("round1/agent", error, "AGENT_ERROR");
  }

  // Per-user throttle so a runaway client (or abuse) can't rack up paid LLM calls.
  const limit = rateLimit(`agent:${user.id}`, 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid Round 1 agent request", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Invalid Round 1 agent request" },
      { status: 400 }
    );
  }

  try {
    const result = await runRound1AgentTurn({
      message: parsed.message,
      form: parsed.form,
      history: parsed.history ?? []
    });
    return NextResponse.json(
      { reply: result.reply, updatedForm: result.updatedForm },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof LLMProviderNotConfiguredError) {
      return NextResponse.json(
        { error: "LLM_PROVIDER_NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error: "AGENT_ERROR",
        reason: error instanceof Error ? error.message : "UNKNOWN_ERROR"
      },
      { status: 502 }
    );
  }
}
