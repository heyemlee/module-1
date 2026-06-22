import { NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError } from "./auth-service";

/**
 * Maps the auth errors thrown by requireUser()/requireRole() to proper HTTP
 * responses (401/403) instead of letting them surface as an opaque 500. Returns
 * null for any other error so callers can apply their own handling (e.g. a Zod
 * 400 or a fallback 500). This is the shared version of the per-route helpers in
 * the admin routes, so a mid-session cookie expiry yields a clean 401 the client
 * can act on rather than a generic "Internal Server Error".
 */
export function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
