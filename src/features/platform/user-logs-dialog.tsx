"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import type { RenderingStat } from "@/server/platform/user-admin-repository";
import { totalUsageCalls, formatUsageDate } from "./admin-presentation";

export function UsageLogContent({
  userName,
  stats,
  error
}: {
  userName: string;
  stats: RenderingStat[] | null;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-4 p-6 bg-studio-void rounded-studio-panel border border-studio-line text-studio-ink relative">
      <div className="space-y-1.5 pr-8">
        <DialogTitle className="text-xl font-bold text-studio-ink">
          Usage for {userName}
        </DialogTitle>
        <DialogDescription className="text-sm text-studio-muted">
          Rendering API calls by date.
        </DialogDescription>
      </div>

      <div className="min-h-[200px] border-t border-studio-line pt-4">
        {error ? (
          <div role="alert" className="rounded-md bg-studio-danger/10 px-4 py-3 text-sm font-medium text-studio-danger">
            {error}
          </div>
        ) : stats === null ? (
          <div className="space-y-3" aria-busy="true">
            <span className="sr-only">Loading usage</span>
            <div className="h-8 w-full rounded-md bg-studio-line-strong studio-skeleton" />
            <div className="h-8 w-full rounded-md bg-studio-line-strong studio-skeleton" />
            <div className="h-8 w-3/4 rounded-md bg-studio-line-strong studio-skeleton" />
          </div>
        ) : stats.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-studio-muted">
            No rendering usage yet
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-studio-ink">
              Total calls: {totalUsageCalls(stats)}
            </div>
            <div className="overflow-hidden rounded-xl border border-studio-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-studio-shell border-b border-studio-line">
                  <tr>
                    <th className="p-3 font-semibold text-studio-muted">Date</th>
                    <th className="p-3 text-right font-semibold text-studio-muted">Calls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-studio-line bg-studio-void">
                  {stats.map((s) => (
                    <tr key={s.date}>
                      <td className="p-3 font-medium text-studio-ink">{formatUsageDate(s.date)}</td>
                      <td className="p-3 text-right text-studio-ink tabular-nums">{s.calls}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-studio-void transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-studio-action focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-studio-shell data-[state=open]:text-studio-muted" aria-label="Close usage dialog">
        <Cross2Icon className="size-4" />
      </DialogClose>
    </div>
  );
}

export function UserLogsDialog({
  open,
  userId,
  userName,
  onOpenChange
}: {
  open: boolean;
  userId: string;
  userName: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [stats, setStats] = useState<RenderingStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setStats(null);
    setError(null);

    fetch(`/api/admin/users/${encodeURIComponent(userId)}/logs`, {
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load usage.");
        return response.json() as Promise<RenderingStat[]>;
      })
      .then(setStats)
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Unable to load usage.");
      });

    return () => controller.abort();
  }, [open, userId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] w-full max-h-[85vh] overflow-y-auto">
        <UsageLogContent userName={userName} stats={stats} error={error} />
      </DialogContent>
    </Dialog>
  );
}
