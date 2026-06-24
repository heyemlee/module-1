import { NextResponse } from "next/server";

// Liveness probe: confirms the process is up and serving. Intentionally the only
// unauthenticated route, and intentionally does NOT touch the database — that is
// a *readiness* concern. ponytail: liveness only; add `await getPool().query("select 1")`
// here (returning 503 on failure) if the deploy platform should gate traffic on
// DB connectivity rather than just process health.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, service: "module-1-round-1" });
}
