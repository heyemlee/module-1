import Link from "next/link";
import type { ProjectSummary } from "@/server/platform/project-repository";
import type { AuthUser } from "@/server/platform/types";
import { PlatformHeader, NavPill } from "./platform-header";

const STATUS_PILL: Record<
  ProjectSummary["status"],
  { label: string; tone: "green" | "amber" | "muted" }
> = {
  DRAFT: { label: "Draft", tone: "muted" },
  ROUND1_SNAPSHOT_READY: { label: "Snapshot saved", tone: "green" },
  ROUND1_RENDERING_READY: { label: "Rendering ready", tone: "green" },
  NEEDS_CONFIRMATION: { label: "Needs confirmation", tone: "amber" },
  ROUND2_READY: { label: "Round 2 ready", tone: "green" },
  ARCHIVED: { label: "Archived", tone: "muted" }
};

const PILL_TONE = {
  green: "bg-[#e6f4ef] text-[#008060]",
  amber: "bg-[#fff0dc] text-[#c56a16]",
  muted: "bg-black/[0.05] text-[#6e6e73]"
};

const CARD_BASE =
  "rounded-[18px] border border-[#d2d2d7] bg-white p-7 min-h-[290px]";

export function ProjectDetail({
  project,
  user
}: {
  project: ProjectSummary;
  user: AuthUser;
}) {
  const isAdmin = user.role === "ADMIN";
  const pill = STATUS_PILL[project.status];

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <PlatformHeader
        userName={user.name}
        nav={
          <>
            <NavPill href="/projects" active>
              Projects
            </NavPill>
            <NavPill href={`/projects/${project.id}/round1`}>Round 1</NavPill>
            <NavPill href={`/projects/${project.id}/renderings`}>Renderings</NavPill>
            {isAdmin && <NavPill href="/admin/users">Admin</NavPill>}
          </>
        }
      />

      <div className="mx-auto max-w-[1320px] px-8 py-10">
        <h1
          className="text-[62px] font-bold leading-[1.05] tracking-[-0.01em] text-[#1d1d1f]"
          style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          {project.customerName}
        </h1>
        <p className="mt-3 text-[16px] text-[#6e6e73]">{project.projectName}</p>
        <div className="mt-5">
          <span
            className={`inline-flex h-7 items-center rounded-full px-3 text-[11px] font-bold ${PILL_TONE[pill.tone]}`}
          >
            {pill.label}
          </span>
        </div>

        <section className="mt-10 grid gap-5 md:grid-cols-3">
          <Link
            href={`/projects/${project.id}/round1`}
            className={`${CARD_BASE} block transition-transform hover:-translate-y-1`}
          >
            <h2 className="text-[24px] font-bold text-[#1d1d1f]">Round 1 Intake</h2>
            <p className="mt-3 max-w-[270px] text-[14px] leading-[21px] text-[#6e6e73]">
              Showroom intake, rough layout, snapshot and rendering.
            </p>
            <PlanGlyph />
          </Link>

          <Link
            href={`/projects/${project.id}/renderings`}
            className={`${CARD_BASE} block transition-transform hover:-translate-y-1`}
          >
            <h2 className="text-[24px] font-bold text-[#1d1d1f]">Renderings</h2>
            <div className="relative mt-5 h-[150px] overflow-hidden rounded-[14px] bg-[#e8e8ed]">
              <div className="absolute left-5 top-5 h-[10px] w-[160px] rounded-full bg-white/45" />
            </div>
            <p className="mt-3 text-[13px] font-bold text-[#1d1d1f]">latest concept</p>
          </Link>

          <div className={`${CARD_BASE} opacity-80`}>
            <h2 className="text-[24px] font-bold text-[#1d1d1f]">Round 2</h2>
            <p className="mt-3 max-w-[260px] text-[14px] leading-[21px] text-[#6e6e73]">
              Reserved for detailed measured design.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

/** Decorative top-down plan thumbnail for the Round 1 card (matches the mock). */
function PlanGlyph() {
  return (
    <div className="relative mt-6 h-[130px] rounded-[14px] border border-[#d2d2d7] bg-white">
      <div className="absolute left-1/2 top-1/2 h-[68px] w-[216px] -translate-x-1/2 -translate-y-1/2 rounded border border-[#1d1d1f]">
        <div className="absolute left-[8px] right-[8px] top-[8px] h-[12px] rounded-sm border border-[#1d1d1f] bg-[#f5f5f7]" />
        <div className="absolute bottom-[8px] left-[8px] h-[22px] w-[16px] rounded-sm border border-[#1d1d1f] bg-[#f5f5f7]" />
        <div className="absolute bottom-[8px] right-[8px] h-[22px] w-[16px] rounded-sm border border-[#1d1d1f] bg-[#f5f5f7]" />
        <div className="absolute bottom-[10px] left-1/2 h-[20px] w-[48px] -translate-x-1/2 rounded border border-[#1d1d1f] bg-[#f5f5f7]" />
        <div className="absolute left-1/2 top-[-5px] h-[10px] w-[68px] -translate-x-1/2 rounded-full border border-[#1d1d1f] bg-[#e8e8ed]" />
        <div className="absolute bottom-[-5px] left-[16px] h-[10px] w-[64px] rounded-full border border-[#c56a16] bg-[#fff0dc]" />
      </div>
    </div>
  );
}
