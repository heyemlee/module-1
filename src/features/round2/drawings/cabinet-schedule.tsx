import {
  formatSixteenths,
  type Round2Model,
  type Round2Wall,
  type WallSegment
} from "../model/round2-model";

const HEIGHT_BY_TIER: Record<string, string> = {
  upper: "36″",
  base: "34 1/2″",
  full: "84″"
};

export function CabinetSchedule({
  model,
  customerName,
  projectName,
  measurementVersion,
  proposalVersion
}: {
  model: Round2Model | null;
  customerName: string;
  projectName: string;
  measurementVersion: number;
  proposalVersion: number;
}) {
  const rows = scheduleRows(model);

  return (
    <div className="min-w-[720px] bg-white p-8 text-[#151515]">
      <div className="flex items-end justify-between border-b-2 border-[#151515] pb-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.14em] text-[#696969]">
            S1 · CABINET SCHEDULE
          </p>
          <h3 className="mt-1 text-[22px] font-semibold">
            {customerName} · {projectName}
          </h3>
        </div>
        <p className="font-mono text-[9px] text-[#696969]">
          MEASUREMENT v{measurementVersion} · PROPOSAL v{proposalVersion}
        </p>
      </div>
      <table className="mt-6 w-full border-collapse font-mono text-[11px]">
        <thead>
          <tr className="border-b border-[#151515] text-left text-[9px] tracking-[0.1em]">
            <th className="px-2 py-3">ID</th>
            <th className="px-2 py-3">WALL</th>
            <th className="px-2 py-3">TYPE</th>
            <th className="px-2 py-3 text-right">WIDTH</th>
            <th className="px-2 py-3 text-right">HEIGHT</th>
            <th className="px-2 py-3 text-right">DEPTH</th>
            <th className="px-2 py-3">NOTES</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="border-b border-black/10">
              <td className="px-2 py-4 text-[#696969]" colSpan={7}>
                Submit measurements to generate the cabinet schedule.
              </td>
            </tr>
          ) : (
            rows.map(({ wall, segment }) => (
              <tr key={segment.id} className="border-b border-black/10">
                <td className="px-2 py-3 text-[#e12821]">
                  {segment.code ?? segment.label}
                </td>
                <td className="px-2 py-3">{wall.label}</td>
                <td className="px-2 py-3">{segment.label}</td>
                <td className="px-2 py-3 text-right text-[#079ca5]">
                  {formatSixteenths(segment.widthSixteenths)}
                </td>
                <td className="px-2 py-3 text-right">
                  {heightForSegment(segment)}
                </td>
                <td className="px-2 py-3 text-right">
                  {depthForSegment(segment)}
                </td>
                <td className="px-2 py-3 text-[#696969]">
                  {noteForSegment(segment)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function scheduleRows(model: Round2Model | null): {
  wall: Round2Wall;
  segment: WallSegment;
}[] {
  if (!model) return [];
  return model.walls.flatMap((wall) =>
    wall.segments
      .filter(
        (segment) =>
          segment.kind === "cabinet" ||
          segment.kind === "appliance" ||
          segment.kind === "filler"
      )
      .map((segment) => ({ wall, segment }))
  );
}

function heightForSegment(segment: WallSegment): string {
  if (segment.cabinetKind === "tall" || segment.kind === "appliance") {
    return "84″";
  }
  return HEIGHT_BY_TIER[segment.tier] ?? "34 1/2″";
}

function depthForSegment(segment: WallSegment): string {
  if (segment.tier !== "upper") return "24″";
  // Refrigerator uppers are the one deep cabinet in the upper run.
  return segment.label.startsWith("WR") ? "24″" : "12″";
}

function noteForSegment(segment: WallSegment): string {
  if (segment.kind === "filler") return "Filler panel / scribe";
  if (segment.cabinetKind === "corner") {
    return "Corner strategy from design intent";
  }
  if (segment.kind === "appliance") return "Verify appliance specification";
  if (segment.cabinetKind === "sink") return "Sink base";
  if (segment.label.startsWith("WB")) return "Trash pullout base";
  if (segment.label.startsWith("DB")) return "Drawer base";
  if (segment.label.startsWith("HD")) return "Hood cabinet";
  if (segment.label.startsWith("WR")) return "Refrigerator upper";
  return "Model-driven proposal";
}
