"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CabinetStyle } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { CabinetColorForm, buildCabinetColorPayload } from "./cabinet-color-form";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "EUROPEAN_FRAMELESS", label: "European Frameless" },
  { value: "AMERICAN_FRAMED", label: "American Framed" }
] as const;

type Draft = {
  cabinetStyle: CabinetStyle;
  name: string;
  promptDescription: string;
  active: boolean;
  swatchData?: string;
  hoverData?: string;
  swatchPreview: string | null;
  hoverPreview: string | null;
};

export function toDraft(color: CabinetColor): Draft {
  return {
    cabinetStyle: color.cabinetStyle,
    name: color.name,
    promptDescription: color.promptDescription,
    active: color.active,
    swatchData: undefined,
    hoverData: undefined,
    swatchPreview: color.swatchImageUrl,
    hoverPreview: color.hoverExampleImageUrl
  };
}

export function buildDrafts(colors: CabinetColor[]) {
  const map: Record<string, Draft> = {};
  for (const color of colors) map[color.id] = toDraft(color);
  return map;
}

export function isDirty(color: CabinetColor, draft: Draft) {
  return (
    draft.name.trim() !== color.name ||
    draft.cabinetStyle !== color.cabinetStyle ||
    draft.promptDescription.trim() !== color.promptDescription ||
    draft.active !== color.active ||
    draft.swatchData !== undefined ||
    draft.hoverData !== undefined
  );
}

export function CabinetColorsManager({ colors }: { colors: CabinetColor[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => buildDrafts(colors));
  const [tab, setTab] = useState<CabinetStyle>("EUROPEAN_FRAMELESS");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<CabinetColor | null>(null);

  const dirtyIds = colors
    .filter((c) => drafts[c.id] && isDirty(c, drafts[c.id]))
    .map((c) => c.id);
  const dirty = dirtyIds.length > 0;

  useEffect(() => {
    setDrafts(buildDrafts(colors));
  }, [colors]);

  function setActive(id: string, active: boolean) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], active } }));
  }

  async function saveAll() {
    if (dirtyIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const requests = dirtyIds.map((id) => {
        const color = colors.find((c) => c.id === id)!;
        const draft = drafts[id];
        return fetch(`/api/admin/cabinet-colors/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildCabinetColorPayload({
              cabinetStyle: draft.cabinetStyle,
              name: draft.name,
              promptDescription: draft.promptDescription,
              swatchImageUrl: draft.swatchData,
              hoverExampleImageUrl: draft.hoverData,
              active: draft.active,
              sortOrder: color.sortOrder
            })
          )
        });
      });
      const results = await Promise.allSettled(requests);
      const failed = results.filter(
        (result) => result.status === "rejected" || !result.value.ok
      ).length;
      if (failed > 0) {
        setError(`Failed to save ${failed} color(s).`);
      } else {
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setBusy(false);
    }
  }

  const tabColors = colors.filter((c) => c.cabinetStyle === tab);
  const tabLabel = TABS.find((t) => t.value === tab)?.label ?? "";

  return (
    <div className="studio-anim-screen flex min-h-[100dvh] flex-col">
      <header className="studio-glass-header sticky top-0 z-[5] flex items-end justify-between gap-4 px-5 pb-[22px] pt-[28px] sm:px-[40px]">
        <div>
          <p className="mb-[9px] font-mono text-[11px] tracking-[0.2em] text-[#86867f]">
            ADMIN / CABINET COLORS
          </p>
          <h1 className="text-[33px] font-semibold tracking-[-0.025em] text-[#16161a]">
            Door color library
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <span role="alert" className="text-[12px] font-medium text-studio-danger">
              {error}
            </span>
          )}
          {dirty && (
            <span className="flex items-center gap-[7px] font-mono text-[10.5px] text-[#86867f]">
              <span className="studio-anim-blink size-[6px] rounded-full bg-studio-ink" />
              UNSAVED CHANGES
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-[12px] border border-white/85 bg-white/60 px-[18px] py-[11px] text-[13px] font-medium text-[#16161a]"
          >
            + Add color
          </button>
          <button
            type="button"
            onClick={saveAll}
            disabled={busy || !dirty}
            className="rounded-[12px] px-[18px] py-[11px] text-[13px] font-medium text-white disabled:cursor-default"
            style={
              dirty && !busy
                ? {
                    background: "linear-gradient(180deg,#2c2c30,#141416)",
                    boxShadow: "0 10px 24px -12px rgba(20,20,26,0.5)"
                  }
                : { background: "rgba(20,20,26,0.16)" }
            }
          >
            {busy ? "Saving…" : "Save all"}
          </button>
        </div>
      </header>

      <div className="px-5 pb-[60px] pt-[26px] sm:px-[40px]">
        <div className="mb-6 inline-flex overflow-hidden rounded-[12px] border border-white/80 bg-white/55">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "px-[18px] py-2.5 text-[13px] font-medium transition-colors",
                t.value === tab
                  ? "bg-studio-ink text-white"
                  : "text-[#6a6a64] hover:text-studio-ink"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tabColors.length === 0 ? (
          <div className="studio-glass flex min-h-48 flex-col items-center justify-center rounded-[18px] px-6 py-12 text-center">
            <p className="text-[14px] font-medium text-[#16161a]">
              No {tabLabel} finishes yet
            </p>
            <p className="mt-1.5 text-[12.5px] text-[#86867f]">
              Add the first one with “+ Add color”.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {tabColors.map((color) => {
              const draft = drafts[color.id] ?? toDraft(color);
              const active = draft.active;
              return (
                <div
                  key={color.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditing(color)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setEditing(color);
                    }
                  }}
                  className="cursor-pointer overflow-hidden rounded-[18px] outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-studio-ink/30"
                  style={{
                    background:
                      "linear-gradient(160deg,rgba(255,255,255,0.58),rgba(255,255,255,0.42))",
                    border: "1px solid rgba(255,255,255,0.78)",
                    boxShadow:
                      "0 1px 0 rgba(255,255,255,0.85) inset,0 16px 40px -24px rgba(20,20,26,0.24)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    opacity: active ? 1 : 0.5
                  }}
                >
                  <div
                    className="relative h-[120px]"
                    style={{ background: color.swatchHex || "#e7e4dd" }}
                  >
                    {draft.swatchPreview && (
                      <img
                        src={draft.swatchPreview}
                        alt={`${color.name} swatch`}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    )}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(155deg,rgba(255,255,255,0.45),transparent 42%)"
                      }}
                    />
                  </div>
                  <div className="p-[14px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[14px] font-semibold text-[#16161a]">
                        {color.name}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActive(color.id, !active);
                        }}
                        aria-pressed={active}
                        aria-label={`${active ? "Disable" : "Enable"} ${color.name}`}
                        className={cn(
                          "shrink-0 rounded-full border border-studio-ink px-[10px] py-[3px] font-mono text-[9.5px] tracking-[0.08em]",
                          active
                            ? "bg-studio-ink text-white"
                            : "bg-transparent text-studio-ink"
                        )}
                      >
                        {active ? "ON" : "OFF"}
                      </button>
                    </div>
                    <p className="mt-1.5 line-clamp-2 font-mono text-[10px] leading-[1.5] text-[#9a9a94]">
                      {color.promptDescription}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && <CabinetColorForm onClose={() => setShowAdd(false)} />}
      {editing && (
        <CabinetColorForm color={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
