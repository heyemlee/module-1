"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockClosedIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle
} from "@/components/ui/dialog";

/** The slice of the current design basis the confirm page needs client-side. */
export type DesignBasisRef = {
  version: number;
  renderingId: string;
  lockedAt: string;
};

export function canConfirmLock(input: { submitting: boolean }): boolean {
  return !input.submitting;
}

export function lockActionLabel(nextVersion: number): string {
  return nextVersion === 1 ? "Lock basis" : "Relock basis";
}

export function LockBasisButton({
  projectId,
  renderingId,
  currentBasis
}: {
  projectId: string;
  renderingId: string;
  currentBasis: DesignBasisRef | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextVersion = (currentBasis?.version ?? 0) + 1;
  const isRelock = currentBasis !== null;

  async function lock() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/design-basis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renderingId })
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(body?.error ?? "Unable to lock design basis");
        setSubmitting(false);
        return;
      }
      setOpen(false);
      setSubmitting(false);
      router.refresh();
    } catch {
      setError("Unable to lock design basis");
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <LockClosedIcon aria-hidden className="mr-1.5" />
        {isRelock ? "Relock basis" : "Lock basis"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(360px,92vw)] rounded-studio-panel border border-studio-line bg-studio-surface p-5 shadow-2xl">
          <DialogTitle className="text-[17px] font-semibold text-studio-ink">
            {isRelock ? "Relock design basis?" : "Lock design basis?"}
          </DialogTitle>
          <p className="mt-2 text-[13px] leading-5 text-studio-muted">
            Confirm locking this rendering as the design basis.
          </p>

          {error && (
            <p role="alert" className="mt-3 text-[12px] text-red-600">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canConfirmLock({ submitting })}
              onClick={lock}
            >
              {submitting ? "Locking…" : lockActionLabel(nextVersion)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
