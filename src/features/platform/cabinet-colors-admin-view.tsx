"use client";

import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { CabinetColorsManager } from "./cabinet-colors-manager";

export function CabinetColorsAdminView({ colors }: { colors: CabinetColor[] }) {
  return <CabinetColorsManager colors={colors} />;
}
