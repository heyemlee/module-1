import type {
  DrawingSheetId,
  Round2Cabinet,
  Round2Measurements
} from "./round2-types";

export const ROUND2_MEASUREMENT_FIXTURE: Round2Measurements = {
  wallA: 2304,
  wallB: 1536,
  wallC: 2112,
  ceiling: 1536,
  windowWidth: 576,
  windowOffset: 672
};

export const ROUND2_CABINET_FIXTURE: readonly Round2Cabinet[] = [
  { id: "a-01", wall: "A", code: "#1", width: 480, kind: "upper", label: "W30" },
  { id: "a-02", wall: "A", code: "#2", width: 432, kind: "upper", label: "W27" },
  { id: "a-03", wall: "A", code: "#3", width: 576, kind: "sink", label: "SB36" },
  { id: "a-04", wall: "A", code: "#4", width: 384, kind: "base", label: "B24" },
  { id: "b-05", wall: "B", code: "#5", width: 480, kind: "upper", label: "W30" },
  { id: "b-06", wall: "B", code: "#6", width: 192, kind: "filler", label: "F12" },
  { id: "b-07", wall: "B", code: "#7", width: 576, kind: "appliance", label: "MW36" },
  { id: "b-08", wall: "B", code: "#8", width: 480, kind: "upper", label: "W30" },
  { id: "b-09", wall: "B", code: "#9", width: 576, kind: "upper", label: "W36" },
  { id: "c-10", wall: "C", code: "#10", width: 480, kind: "base", label: "B30" },
  { id: "c-11", wall: "C", code: "#11", width: 432, kind: "base", label: "B27" },
  { id: "c-12", wall: "C", code: "#12", width: 288, kind: "base", label: "B18" },
  { id: "c-13", wall: "C", code: "#13", width: 576, kind: "sink", label: "SB36" },
  { id: "c-14", wall: "C", code: "#14", width: 384, kind: "appliance", label: "DW24" }
] as const;

export const ROUND2_SHEETS: readonly {
  id: DrawingSheetId;
  label: string;
}[] = [
  { id: "A1", label: "Measured floor plan" },
  { id: "A2", label: "Wall A elevation" },
  { id: "A3", label: "Wall B elevation" },
  { id: "A4", label: "Wall C elevation" },
  { id: "S1", label: "Cabinet schedule" }
] as const;
