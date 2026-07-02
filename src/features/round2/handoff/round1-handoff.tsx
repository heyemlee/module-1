"use client";

import Link from "next/link";
import { CheckIcon, LockClosedIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import type {
  Round1ReferenceSource,
  Round2DemoRole
} from "../round2-types";

export function Round1Handoff({
  reference,
  role,
  onLock,
  nextReferenceVersion,
  round1Href = "#"
}: {
  reference: Round1ReferenceSource | null;
  role: Round2DemoRole;
  onLock: (snapshotId: string) => void;
  nextReferenceVersion: number;
  round1Href?: string;
}) {
  return (
    <div className="h-full overflow-y-auto bg-studio-canvas px-4 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-col gap-5 border-b border-studio-line pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[9px] tracking-[0.17em] text-studio-quiet">
              ROUND 1 → ROUND 2
            </p>
            <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.035em] text-studio-ink sm:text-[38px]">
              Round 1 handoff
            </h1>
            <p className="mt-3 max-w-[620px] text-[13px] leading-6 text-studio-muted">
              Round 2 starts from one complete, locked Round 1 layout. The snapshot supplies layout intent, appliances, style and color; Sales field measurements remain the dimensional authority.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-studio-control border border-studio-line bg-white/60 px-3 py-2 font-mono text-[8.5px] tracking-[0.1em] text-studio-muted">
            <LockClosedIcon aria-hidden />
            WORKFLOW LOCKED
          </div>
        </div>

        {reference ? (
          <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_360px]">
            <section className="overflow-hidden rounded-[20px] border border-white/80 bg-white/55 shadow-[0_28px_65px_-40px_rgba(20,20,26,0.45)] backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-studio-line px-5 py-4">
                <div>
                  <p className="font-mono text-[9px] tracking-[0.15em] text-studio-quiet">
                    AVAILABLE SNAPSHOT
                  </p>
                  <h2 className="mt-1 text-[17px] font-semibold">
                    {reference.layoutLabel} · Round 1 layout
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-studio-ink px-2.5 py-1.5 font-mono text-[8px] tracking-[0.08em] text-white">
                  <CheckIcon aria-hidden />
                  COMPLETE
                </span>
              </div>
              <div className="bg-[#17191a] p-4 sm:p-6">
                <ReferencePlan reference={reference} />
              </div>
              <div className="grid gap-px border-t border-studio-line bg-studio-line sm:grid-cols-3">
                <ReferenceMetric label="LAYOUT" value={reference.layoutLabel} />
                <ReferenceMetric label="STYLE" value={reference.styleLabel} />
                <ReferenceMetric label="COLOR" value={reference.colorLabel} />
              </div>
            </section>

            <aside className="rounded-[20px] border border-white/80 bg-white/65 p-5 shadow-[0_28px_65px_-40px_rgba(20,20,26,0.38)] backdrop-blur-xl">
              <p className="font-mono text-[9px] tracking-[0.15em] text-studio-quiet">
                SOURCE REVIEW
              </p>
              <div className="mt-4 space-y-4">
                <SourceRow label="Generated" value={new Date(reference.generatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })} />
                <SourceRow label="Snapshot" value={reference.id.slice(0, 12)} mono />
                <SourceRow label="Open confirmations" value={String(reference.confirmationCount)} />
              </div>

              <div className="mt-6 border-t border-studio-line pt-5">
                <p className="font-mono text-[8px] tracking-[0.13em] text-studio-quiet">
                  APPLIANCES
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {reference.appliances.map((appliance) => (
                    <span
                      key={appliance}
                      className="rounded-[8px] border border-studio-line bg-white/75 px-2.5 py-2 text-[10.5px] font-semibold"
                    >
                      {appliance}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-studio-control border border-[#d8bd84] bg-[#fbf4e4] p-3">
                <p className="font-mono text-[8px] tracking-[0.12em] text-[#805617]">
                  LOCK EFFECT
                </p>
                <p className="mt-1.5 text-[10.5px] leading-4 text-[#755827]">
                  Creates Reference v{nextReferenceVersion}. Round 2 changes become proposal versions and never rewrite this snapshot.
                </p>
              </div>

              <Button
                type="button"
                className="mt-5 w-full"
                disabled={!reference.complete}
                onClick={() => onLock(reference.id)}
              >
                {nextReferenceVersion === 1
                  ? "Lock for Round 2"
                  : "Relock for Round 2"}
              </Button>
              <p className="mt-2 text-center font-mono text-[8px] tracking-[0.09em] text-studio-quiet">
                {role} · AUTHORIZED TO LOCK
              </p>
            </aside>
          </div>
        ) : (
          <div className="mt-8 rounded-[20px] border border-studio-line bg-white/60 p-8 text-center">
            <h2 className="text-[19px] font-semibold">Complete Round 1 first</h2>
            <p className="mx-auto mt-2 max-w-[480px] text-[12.5px] leading-5 text-studio-muted">
              Round 2 requires a generated cabinet-fill snapshot with fixed positions confirmed.
            </p>
            <Button asChild className="mt-5">
              <Link href={round1Href}>Return to Round 1</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReferencePlan({ reference }: { reference: Round1ReferenceSource }) {
  const plan = reference.floorPlan;
  return (
    <svg
      viewBox={`0 0 ${plan.canvas.w} ${plan.canvas.h}`}
      role="img"
      aria-label={`Round 1 ${reference.layoutLabel} reference plan`}
      className="mx-auto block aspect-[760/560] max-h-[500px] w-full"
    >
      <rect
        x={plan.room.x}
        y={plan.room.y}
        width={plan.room.w}
        height={plan.room.h}
        fill="#202324"
        stroke="#f0f0eb"
        strokeWidth={plan.room.thickness}
      />
      <rect
        x={plan.room.x + plan.room.thickness}
        y={plan.room.y + plan.room.thickness}
        width={plan.room.w - plan.room.thickness * 2}
        height={plan.room.h - plan.room.thickness * 2}
        fill="#17191a"
      />
      {[...plan.baseCabinets, ...plan.wallCabinets, ...plan.peninsulaCabinets].map(
        (cabinet, index) => (
          <g key={`${cabinet.code}-${index}`}>
            <rect
              x={cabinet.x}
              y={cabinet.y}
              width={cabinet.w}
              height={cabinet.h}
              fill="#d7dad5"
              stroke="#8e9690"
              strokeWidth="1.5"
            />
            <text
              x={cabinet.x + cabinet.w / 2}
              y={cabinet.y + cabinet.h / 2 + 3}
              textAnchor="middle"
              fontFamily="var(--studio-mono)"
              fontSize="9"
              fill="#292e2b"
            >
              {cabinet.code}
            </text>
          </g>
        )
      )}
      {plan.window && (
        <rect
          x={plan.window.x}
          y={plan.window.y}
          width={plan.window.w}
          height={plan.window.h}
          fill="#4f98b8"
        />
      )}
    </svg>
  );
}

function ReferenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/65 px-5 py-4">
      <p className="font-mono text-[8px] tracking-[0.13em] text-studio-quiet">{label}</p>
      <p className="mt-1 text-[12px] font-semibold">{value}</p>
    </div>
  );
}

function SourceRow({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-studio-line pb-3">
      <span className="text-[11px] text-studio-muted">{label}</span>
      <span className={mono ? "font-mono text-[9px]" : "text-[11px] font-semibold"}>
        {value}
      </span>
    </div>
  );
}
