"use client";

import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { CabinetColorForm } from "./cabinet-color-form";
import { CabinetColorsManager } from "./cabinet-colors-manager";
import { StudioPage, StudioPageHeader, StudioStat, StudioSection } from "./studio-page";
import { cabinetColorSummary } from "./admin-presentation";

export function CabinetColorsAdminView({
  colors
}: {
  colors: CabinetColor[];
}) {
  const summary = cabinetColorSummary(colors);

  return (
    <StudioPage>
      <StudioPageHeader
        title="Cabinet Colors"
        description="Manage your inventory of cabinet finishes and metadata."
        meta={
          <div className="grid max-w-sm grid-cols-2 gap-4">
            <StudioStat label="Active" value={summary.active} />
            <StudioStat label="Hidden" value={summary.hidden} tone="warning" />
          </div>
        }
      />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div aria-label="Cabinet colors list">
          <CabinetColorsManager colors={colors} />
        </div>
        <CabinetColorForm />
      </div>
    </StudioPage>
  );
}
