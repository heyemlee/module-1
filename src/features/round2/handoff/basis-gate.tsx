"use client";

import Link from "next/link";
import { LockOpen1Icon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";

/**
 * Shown when the project has no locked design basis. Technical design never
 * picks a Round 1 snapshot itself — the customer confirms a rendering on the
 * proposal page and that lock is the only way in, so the two phases can never
 * disagree about which layout/finish the customer approved.
 */
export function BasisGate({
  confirmHref,
  hasRenderings
}: {
  confirmHref: string;
  hasRenderings: boolean;
}) {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-studio-canvas px-4 py-8">
      <div className="w-full max-w-[560px] rounded-[20px] border border-studio-line bg-white/60 p-10 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-studio-line bg-white/80 text-studio-muted">
          <LockOpen1Icon aria-hidden width={20} height={20} />
        </span>
        <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-studio-ink">
          No design basis locked
        </h1>
        <p className="mx-auto mt-3 max-w-[440px] text-[13px] leading-6 text-studio-muted">
          {hasRenderings
            ? "Technical design starts from the rendering the customer confirmed. Lock it as the design basis on the proposal page — that packages the layout snapshot, style and color this workspace reads."
            : "Technical design starts from a customer-confirmed rendering. Complete the concept phase, generate renderings, and lock the confirmed one as the design basis."}
        </p>
        <Button asChild className="mt-6">
          <Link href={confirmHref}>
            {hasRenderings ? "Open proposal & confirm" : "Open concept phase"}
          </Link>
        </Button>
        <p className="mt-4 font-mono text-[8.5px] tracking-[0.12em] text-studio-quiet">
          MEASUREMENT · PROPOSAL · DRAWINGS UNLOCK AFTER LOCKING
        </p>
      </div>
    </div>
  );
}
