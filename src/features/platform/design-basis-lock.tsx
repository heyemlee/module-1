"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockClosedIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

/**
 * Locking is enabled once the customer's outstanding Confirmation Required
 * items are explicitly acknowledged (they never block, matching the Round 1
 * philosophy) and no request is in flight.
 */
export function canConfirmLock(input: {
  confirmationCount: number;
  acknowledged: boolean;
  submitting: boolean;
}): boolean {
  if (input.submitting) return false;
  return input.confirmationCount === 0 || input.acknowledged;
}

export function lockActionLabel(nextVersion: number): string {
  return nextVersion === 1
    ? "Lock as design basis"
    : `Relock as basis v${nextVersion}`;
}

export function LockBasisButton({
  projectId,
  renderingId,
  colorName,
  styleLabel,
  confirmationCount,
  currentBasis
}: {
  projectId: string;
  renderingId: string;
  colorName: string;
  styleLabel: string | null;
  confirmationCount: number;
  currentBasis: DesignBasisRef | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
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
          setAcknowledged(false);
          setError(null);
          setOpen(true);
        }}
      >
        <LockClosedIcon aria-hidden className="mr-1.5" />
        {isRelock ? "Relock basis" : "Lock basis"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(440px,92vw)] rounded-studio-panel border border-studio-line bg-studio-surface p-6 shadow-2xl">
          <DialogTitle className="text-[17px] font-semibold text-studio-ink">
            {lockActionLabel(nextVersion)}
          </DialogTitle>
          <p className="mt-2 text-[12.5px] leading-5 text-studio-muted">
            The design basis packages this rendering with the layout snapshot,
            style and color it was generated from. Technical design reads only
            the locked basis.
          </p>

          <dl className="mt-4 space-y-2 border-t border-studio-line pt-4">
            <BasisFact label="Color" value={colorName} />
            {styleLabel && <BasisFact label="Style" value={styleLabel} />}
            <BasisFact label="Version" value={`v${nextVersion}`} />
          </dl>

          {isRelock && (
            <p className="mt-4 rounded-studio-control border border-[#d8bd84] bg-[#fbf4e4] p-3 text-[11.5px] leading-4 text-[#755827]">
              Relocking replaces basis v{currentBasis.version}. If field
              measurement has started, its draft is archived and the
              technical-design workspace restarts from the new basis.
            </p>
          )}

          {confirmationCount > 0 && (
            <label className="mt-4 flex items-start gap-2.5 rounded-studio-control border border-studio-line bg-studio-canvas p-3">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(value) => setAcknowledged(value === true)}
                aria-label="Acknowledge open confirmation items"
              />
              <span className="text-[11.5px] leading-4 text-studio-muted">
                The customer accepts that {confirmationCount} confirmation{" "}
                {confirmationCount === 1 ? "item" : "items"} from Round 1{" "}
                {confirmationCount === 1 ? "remains" : "remain"} open and will be
                resolved during field measurement.
              </span>
            </label>
          )}

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
              disabled={
                !canConfirmLock({ confirmationCount, acknowledged, submitting })
              }
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

function BasisFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[11px] text-studio-muted">{label}</dt>
      <dd className="text-[12px] font-semibold text-studio-ink">{value}</dd>
    </div>
  );
}
