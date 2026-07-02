import { ROUND2_CABINET_FIXTURE } from "../round2-fixtures";

const HEIGHT: Record<string, number> = {
  upper: 36,
  base: 34.5,
  sink: 34.5,
  appliance: 84,
  filler: 84,
  tall: 84
};

export function CabinetSchedule() {
  return (
    <div className="min-w-[720px] bg-white p-8 text-[#151515]">
      <div className="flex items-end justify-between border-b-2 border-[#151515] pb-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.14em] text-[#696969]">
            S1 · CABINET SCHEDULE
          </p>
          <h3 className="mt-1 text-[22px] font-semibold">Mike · Main Kitchen</h3>
        </div>
        <p className="font-mono text-[9px] text-[#696969]">PROPOSAL v2</p>
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
          {ROUND2_CABINET_FIXTURE.map((cabinet) => (
            <tr key={cabinet.id} className="border-b border-black/10">
              <td className="px-2 py-3 text-[#e12821]">{cabinet.code}</td>
              <td className="px-2 py-3">{cabinet.wall}</td>
              <td className="px-2 py-3">{cabinet.label}</td>
              <td className="px-2 py-3 text-right text-[#079ca5]">{cabinet.width / 16}″</td>
              <td className="px-2 py-3 text-right">{HEIGHT[cabinet.kind]}″</td>
              <td className="px-2 py-3 text-right">{cabinet.kind === "upper" ? 12 : 24}″</td>
              <td className="px-2 py-3 text-[#696969]">
                {cabinet.kind === "appliance" ? "Verify appliance specification" : "Fixture proposal"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
