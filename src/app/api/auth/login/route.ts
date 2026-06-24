import { NextResponse } from "next/server";
import { z } from "zod";
import { loginWithPassword, setSessionCookie, UnauthorizedError } from "@/server/platform/auth-service";
import { serverError } from "@/server/platform/api-errors";
import { clientKey, rateLimit } from "@/server/platform/rate-limit";

const requestSchema = z.object({
  account: z.string().trim().min(1),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  // Throttle credential guessing: 10 attempts/minute per client IP. Combined with
  // constant-time verification in loginWithPassword, this blunts both brute-force
  // and timing-based account enumeration.
  const limit = rateLimit(`login:${clientKey(request)}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  try {
    const input = requestSchema.parse(await request.json());
    const session = await loginWithPassword(input.account, input.password);
    await setSessionCookie(session.id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid login request" }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Invalid account or password" }, { status: 401 });
    }
    return serverError("auth/login", error, "Unable to log in");
  }
}
