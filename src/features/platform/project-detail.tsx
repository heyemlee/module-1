"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/server/platform/project-repository";
import {
  projectNextAction,
  projectStatusPresentation
} from "./project-presentation";

type NodeState = "done" | "active" | "todo";

const NODE_CLASS: Record<NodeState, string> = {
  done: "bg-[#1a1a1c] text-white",
  active:
    "border-[1.5px] border-[#1a1a1c] bg-[rgba(255,255,255,0.92)] text-[#16161a] shadow-[0_8px_18px_-10px_rgba(20,20,26,0.35)]",
  todo: "border-[1.5px] border-[rgba(20,20,26,0.14)] bg-white/50 text-[#bcbcb6]"
};

export function ProjectDetail({
  project,
  progress
}: {
  project: ProjectSummary;
  progress: {
    hasRound1State: boolean;
    hasSnapshot: boolean;
    latestRendering: {
      id: string;
      createdAt: string;
      styleLabel?: string | null;
      colorName?: string | null;
    } | null;
  };
}) {
  const router = useRouter();
  const [aiText, setAiText] = useState("");

  const status = projectStatusPresentation(project.status);
  const nextAction = projectNextAction({
    hasRound1State: progress.hasRound1State,
    hasSnapshot: progress.hasSnapshot,
    hasRendering: Boolean(progress.latestRendering)
  });
  const nextHref =
    nextAction.destination === "renderings"
      ? `/projects/${project.id}/renderings`
      : `/projects/${project.id}/round1`;

  // Phase staging mirrors the design: driven by project status.
  const stage =
    project.status === "INTAKE" ? 0 : project.status === "RENDERING_READY" ? 1 : 2;

  const phases: {
    idx: string;
    title: string;
    desc: string;
    href: string;
    node: NodeState;
    lineOn: boolean;
    tagLabel: string;
    tagActive: boolean;
  }[] = [
    {
      idx: "1",
      title: "Round 1",
      desc: "Store questionnaire & rough layout. Room, openings, appliances, draggable plan and cabinet fill.",
      href: `/projects/${project.id}/round1`,
      node: stage > 0 ? "done" : "active",
      lineOn: stage > 0,
      tagLabel: stage > 0 ? "COMPLETE" : "IN PROGRESS",
      tagActive: true
    },
    {
      idx: "2",
      title: "Rendering",
      desc: "Deterministic plan + finish selection produce a client concept image.",
      href: `/projects/${project.id}/renderings`,
      node: stage > 1 ? "done" : stage === 1 ? "active" : "todo",
      lineOn: stage > 1,
      tagLabel: stage > 1 ? "COMPLETE" : stage === 1 ? "CURRENT" : "LOCKED",
      tagActive: stage >= 1
    },
    {
      idx: "3",
      title: "Round 2",
      desc: "Detailed field measurement, cabinet design, drawings and review.",
      href: `/projects/${project.id}/round2`,
      node: stage > 1 ? "active" : "todo",
      lineOn: false,
      tagLabel: "UPCOMING",
      tagActive: stage > 1
    }
  ];

  function aiSend() {
    const text = aiText.trim();
    if (!text) return;
    router.push(
      `/projects/${project.id}/round1?intake=${encodeURIComponent(text)}`
    );
  }

  const latestMeta = progress.latestRendering
    ? [progress.latestRendering.styleLabel, progress.latestRendering.colorName]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="studio-anim-screen flex min-h-[100dvh] flex-col">
      <header className="studio-glass-header sticky top-0 z-[5] px-5 pb-[26px] pt-[28px] sm:px-[40px]">
        <Link
          href="/projects"
          className="mb-4 inline-block font-mono text-[11px] tracking-[0.1em] text-[#86867f] transition-colors hover:text-studio-ink"
        >
          ← ALL PROJECTS
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-3">
              <span className="font-mono text-[11px] tracking-[0.16em] text-[#86867f]">
                {project.customerName}
              </span>
              <span
                data-project-status={project.status}
                className={cn(
                  "inline-flex items-center rounded-full px-[11px] py-1 font-mono text-[9.5px] tracking-[0.1em]",
                  project.status === "INTAKE" &&
                    "border border-white/85 bg-white/70 text-[#56564f]",
                  project.status === "RENDERING_READY" &&
                    "bg-[#1a1a1c] text-white",
                  project.status === "ROUND2_MEASURING" &&
                    "border border-dashed border-[#b0b0aa] bg-white/50 text-[#56564f]",
                  project.status === "ARCHIVED" &&
                    "border border-white/65 bg-white/40 text-[#a0a09a]"
                )}
              >
                {status.label}
              </span>
            </div>
            <h1 className="text-[33px] font-semibold tracking-[-0.025em] text-[#16161a]">
              {project.projectName}
            </h1>
          </div>
          <Link
            href={nextHref}
            className="shrink-0 self-start rounded-[13px] px-[22px] py-[14px] text-[13.5px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_26px_-12px_rgba(20,20,26,0.5)]"
            style={{ background: "linear-gradient(180deg,#2c2c30,#141416)" }}
          >
            {nextAction.label} →
          </Link>
        </div>
      </header>

      <div className="grid gap-[30px] px-5 pb-[60px] pt-[32px] sm:px-[40px] lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {/* phases + AI intake */}
        <section>
          <p className="mb-[18px] font-mono text-[11px] tracking-[0.16em] text-[#86867f]">
            PROJECT PHASES
          </p>

          {phases.map((phase) => (
            <Link
              key={phase.idx}
              href={phase.href}
              className="-mx-3 flex cursor-pointer gap-[18px] rounded-[14px] px-3 pb-1 pt-1.5 transition-colors hover:bg-white/60"
            >
              <div className="flex flex-col items-center self-stretch">
                <span
                  className={cn(
                    "flex size-[30px] shrink-0 items-center justify-center rounded-full font-mono text-[12px]",
                    NODE_CLASS[phase.node]
                  )}
                >
                  {phase.idx}
                </span>
                <span
                  className={cn(
                    "min-h-[30px] w-[1.5px] flex-1",
                    phase.lineOn ? "bg-[#1a1a1c]" : "bg-[rgba(20,20,26,0.12)]"
                  )}
                />
              </div>
              <div className="flex flex-1 items-start justify-between gap-3 pb-[26px]">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2.5">
                    <span className="text-[17px] font-semibold text-[#16161a]">
                      {phase.title}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-[9px] py-[3px] font-mono text-[9px] tracking-[0.1em]",
                        phase.tagActive
                          ? "bg-[#1a1a1c] text-white"
                          : "border border-white/70 bg-white/60 text-[#9a9a94]"
                      )}
                    >
                      {phase.tagLabel}
                    </span>
                  </div>
                  <p className="max-w-[46ch] text-[13.5px] leading-[1.5] text-[#73736e]">
                    {phase.desc}
                  </p>
                </div>
                <span className="mt-[3px] shrink-0 text-[15px] text-[#bcbcb6]">
                  →
                </span>
              </div>
            </Link>
          ))}

          <div className="mt-4 border-t border-[rgba(20,20,26,0.08)] pt-[22px]">
            <p className="mb-3 font-mono text-[11px] tracking-[0.16em] text-[#86867f]">
              AI INTAKE · AUTOFILL ROUND 1
            </p>
            <div className="flex items-center gap-[9px] rounded-[15px] border border-white/85 bg-white/[0.62] py-2 pl-4 pr-[9px] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_16px_34px_-22px_rgba(20,20,26,0.32)]">
              <input
                value={aiText}
                onChange={(event) => setAiText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") aiSend();
                }}
                placeholder="Describe the kitchen — e.g. 4.2m by 3.6m, L-shape, island, sink, fridge, dishwasher…"
                aria-label="Describe the kitchen to autofill Round 1"
                className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-[#16161a] outline-none placeholder:text-[#9a9a94]"
              />
              <button
                type="button"
                title="Voice input (optional)"
                aria-label="Voice input (optional)"
                className="flex size-9 shrink-0 items-center justify-center rounded-[11px] border border-[rgba(20,20,26,0.1)] bg-white/60 text-[#56564f]"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0M12 18v3" />
                </svg>
              </button>
              <button
                type="button"
                onClick={aiSend}
                title="Autofill Round 1"
                aria-label="Autofill Round 1"
                className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-[16px] text-white"
                style={{ background: "linear-gradient(180deg,#2c2c30,#141416)" }}
              >
                ↑
              </button>
            </div>
          </div>
        </section>

        {/* latest concept */}
        <section
          className="overflow-hidden rounded-[20px]"
          style={{
            background:
              "linear-gradient(160deg,rgba(255,255,255,0.6),rgba(255,255,255,0.42))",
            border: "1px solid rgba(255,255,255,0.75)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.85) inset,0 22px 54px -28px rgba(20,20,26,0.28)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)"
          }}
        >
          <div className="flex items-center justify-between border-b border-[rgba(20,20,26,0.07)] px-4 py-[14px]">
            <span className="font-mono text-[10.5px] tracking-[0.14em] text-[#86867f]">
              LATEST CONCEPT
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-[9px] py-[3px] font-mono text-[9px] tracking-[0.1em]",
                progress.latestRendering
                  ? "bg-[#1a1a1c] text-white"
                  : "border border-[rgba(20,20,26,0.18)] text-[#9a9a94]"
              )}
            >
              {progress.latestRendering ? "LATEST" : "—"}
            </span>
          </div>
          <div
            className="relative m-[14px] aspect-[4/3] overflow-hidden rounded-[14px]"
            style={{
              background: progress.latestRendering
                ? "linear-gradient(162deg,#3a3a3e,#101012)"
                : "linear-gradient(160deg,#26262a,#161618)"
            }}
          >
            {progress.latestRendering ? (
              <>
                <img
                  src={`/api/projects/${project.id}/round1/renderings/${progress.latestRendering.id}/image`}
                  alt="Latest concept rendering"
                  className="h-full w-full object-cover"
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg,transparent 52%,rgba(10,10,12,0.78))"
                  }}
                />
                {latestMeta && (
                  <div className="absolute bottom-[14px] left-4 font-mono text-[10.5px] tracking-[0.1em] text-white">
                    {latestMeta}
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] tracking-[0.1em] text-[#6a6a64]">
                NO RENDER YET
              </div>
            )}
          </div>
          <Link
            href={`/projects/${project.id}/renderings`}
            className="block w-full border-t border-[rgba(20,20,26,0.07)] py-[13px] text-center text-[12.5px] font-medium text-[#16161a] transition-colors hover:bg-white/40"
          >
            View all renderings →
          </Link>
        </section>
      </div>
    </div>
  );
}
