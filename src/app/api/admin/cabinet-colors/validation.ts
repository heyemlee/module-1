import { cabinetColorInputSchema } from "@/server/platform/cabinet-color-repository";

export function parseCabinetColorRequest(value: unknown) {
  return cabinetColorInputSchema.parse(value);
}
