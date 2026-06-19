import { NextResponse } from "next/server";
import { z } from "zod";
import { loginWithPassword, setSessionCookie, UnauthorizedError } from "@/server/platform/auth-service";

const requestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    const session = await loginWithPassword(input.email, input.password);
    await setSessionCookie(session.id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid login request" }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to log in" }, { status: 500 });
  }
}
