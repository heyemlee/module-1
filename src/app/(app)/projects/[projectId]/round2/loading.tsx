export default function ProjectRound2Loading() {
  return (
    <div
      aria-label="Loading Round 2"
      className="flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-studio-void"
    >
      <div className="studio-skeleton h-[68px] border-b border-studio-line" />
      <div className="grid h-[58px] grid-cols-3 gap-px border-b border-studio-line bg-studio-line">
        <div className="studio-skeleton" />
        <div className="studio-skeleton" />
        <div className="studio-skeleton" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[380px_minmax(0,1fr)]">
        <div className="studio-skeleton border-r border-studio-line" />
        <div className="grid min-h-0 gap-3 p-4 lg:grid-cols-[1.15fr_.85fr]">
          <div className="studio-skeleton rounded-[18px]" />
          <div className="studio-skeleton rounded-[18px]" />
        </div>
      </div>
    </div>
  );
}
