import type { SegmentRole } from "./model/segment-role";

// Line-work appliance fronts shared by the workspace elevation and the
// A-series drawing sheets. Pure presentation: the caller passes the segment
// box; nothing here feeds back into the model. Every glyph is scaled off the
// box so it survives both the 1:30 workspace canvas and the sheet canvas.

type GlyphBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
};

export function ApplianceGlyph({
  role,
  ...box
}: GlyphBox & { role: SegmentRole }) {
  switch (role) {
    case "sink":
      return <SinkGlyph {...box} />;
    case "dishwasher":
      return <DishwasherGlyph {...box} />;
    case "range":
      return <RangeGlyph {...box} />;
    case "fridge":
      return <FridgeGlyph {...box} />;
    case "oven":
      return <OvenGlyph {...box} />;
    case "microwave":
      return <MicrowaveGlyph {...box} />;
    case "hood":
      return <HoodGlyph {...box} />;
  }
}

export function WindowGlyph({ x, y, width, height, stroke }: GlyphBox) {
  const m = 3;
  const frameWidth = Math.max(1, width - m * 2);
  const frameHeight = Math.max(1, height - m * 2);
  const cx = x + width / 2;

  return (
    <g data-glyph="window" stroke={stroke} fill="none">
      <rect x={x + m} y={y + m} width={frameWidth} height={frameHeight} strokeWidth="1.5" />
      <rect
        x={x + m + 2}
        y={y + m + 2}
        width={Math.max(1, frameWidth - 4)}
        height={Math.max(1, frameHeight - 4)}
        strokeWidth="1"
        strokeOpacity="0.5"
      />
      <line x1={cx} y1={y + m} x2={cx} y2={y + height - m} strokeWidth="1.5" />
    </g>
  );
}

/** Faucet above the counter line plus the sink rim, over the door front. */
function SinkGlyph({ x, y, width, stroke }: GlyphBox) {
  const cx = x + width / 2;
  const rim = Math.min(width * 0.42, 30);
  return (
    <g data-appliance-role="sink" stroke={stroke} strokeWidth="1.1" fill="none">
      <line x1={cx - rim} y1={y + 4} x2={cx + rim} y2={y + 4} />
      <path
        d={`M ${cx - 4} ${y} h 8 M ${cx} ${y} v -10 q 0 -5 6 -5 h 4 v 4`}
      />
    </g>
  );
}

function DishwasherGlyph({ x, y, width, height, stroke }: GlyphBox) {
  const m = 3;
  const strip = y + m + Math.min(height * 0.16, 13);
  return (
    <g
      data-appliance-role="dishwasher"
      stroke={stroke}
      strokeWidth="1.1"
      fill="none"
    >
      <rect x={x + m} y={y + m} width={width - m * 2} height={height - m * 2} />
      <line x1={x + m} y1={strip} x2={x + width - m} y2={strip} />
      <circle cx={x + width - m - 8} cy={(y + m + strip) / 2} r="1.6" />
      <circle cx={x + width - m - 15} cy={(y + m + strip) / 2} r="1.6" />
      <line
        x1={x + width * 0.3}
        y1={strip + 4}
        x2={x + width * 0.7}
        y2={strip + 4}
        strokeWidth="2"
      />
    </g>
  );
}

function RangeGlyph({ x, y, width, height, stroke }: GlyphBox) {
  const m = 3;
  const strip = y + m + Math.min(height * 0.16, 13);
  const knobY = (y + m + strip) / 2;
  const ovenTop = y + height * 0.4;
  const ovenBottom = y + height * 0.72;
  return (
    <g
      data-appliance-role="range"
      stroke={stroke}
      strokeWidth="1.1"
      fill="none"
    >
      <rect x={x + m} y={y + m} width={width - m * 2} height={height - m * 2} />
      <line x1={x + m} y1={strip} x2={x + width - m} y2={strip} />
      {[0.25, 0.42, 0.58, 0.75].map((ratio) => (
        <circle key={ratio} cx={x + width * ratio} cy={knobY} r="1.8" />
      ))}
      <line
        x1={x + width * 0.28}
        y1={ovenTop - 6}
        x2={x + width * 0.72}
        y2={ovenTop - 6}
        strokeWidth="2"
      />
      <rect
        x={x + width * 0.28}
        y={ovenTop}
        width={width * 0.44}
        height={ovenBottom - ovenTop}
      />
    </g>
  );
}

/** Full-height fridge: split doors with handles at the split. */
function FridgeGlyph({ x, y, width, height, stroke }: GlyphBox) {
  const m = 3;
  const cx = x + width / 2;
  const handleTop = y + height * 0.24;
  const handleBottom = y + height * 0.46;
  return (
    <g
      data-appliance-role="fridge"
      stroke={stroke}
      strokeWidth="1.1"
      fill="none"
    >
      <rect x={x + m} y={y + m} width={width - m * 2} height={height - m * 2} />
      <line x1={cx} y1={y + m} x2={cx} y2={y + height - m} />
      <line x1={cx - 5} y1={handleTop} x2={cx - 5} y2={handleBottom} strokeWidth="2" />
      <line x1={cx + 5} y1={handleTop} x2={cx + 5} y2={handleBottom} strokeWidth="2" />
    </g>
  );
}

/** Tall oven unit: control panel, oven window, storage below. */
function OvenGlyph({ x, y, width, height, stroke }: GlyphBox) {
  const m = 3;
  const panel = y + height * 0.14;
  const windowTop = y + height * 0.2;
  const windowBottom = y + height * 0.42;
  const split = y + height * 0.55;
  return (
    <g data-appliance-role="oven" stroke={stroke} strokeWidth="1.1" fill="none">
      <rect x={x + m} y={y + m} width={width - m * 2} height={height - m * 2} />
      <line x1={x + m} y1={panel} x2={x + width - m} y2={panel} />
      <circle cx={x + width * 0.35} cy={(y + m + panel) / 2} r="1.8" />
      <circle cx={x + width * 0.65} cy={(y + m + panel) / 2} r="1.8" />
      <rect
        x={x + width * 0.22}
        y={windowTop}
        width={width * 0.56}
        height={windowBottom - windowTop}
      />
      <line x1={x + m} y1={split} x2={x + width - m} y2={split} />
    </g>
  );
}

/** Tall unit with a built-in microwave box and vent slots. */
function MicrowaveGlyph({ x, y, width, height, stroke }: GlyphBox) {
  const m = 3;
  const boxTop = y + height * 0.14;
  const boxBottom = y + height * 0.34;
  const doorRight = x + width * 0.62;
  const split = y + height * 0.42;
  return (
    <g
      data-appliance-role="microwave"
      stroke={stroke}
      strokeWidth="1.1"
      fill="none"
    >
      <rect x={x + m} y={y + m} width={width - m * 2} height={height - m * 2} />
      <rect
        x={x + width * 0.14}
        y={boxTop}
        width={width * 0.72}
        height={boxBottom - boxTop}
      />
      <line x1={doorRight} y1={boxTop} x2={doorRight} y2={boxBottom} />
      {[0.35, 0.55, 0.75].map((ratio) => (
        <line
          key={ratio}
          x1={doorRight + (x + width * 0.86 - doorRight) * 0.3}
          y1={boxTop + (boxBottom - boxTop) * ratio}
          x2={x + width * 0.86 - (x + width * 0.86 - doorRight) * 0.3}
          y2={boxTop + (boxBottom - boxTop) * ratio}
          strokeWidth="0.7"
        />
      ))}
      <line x1={x + m} y1={split} x2={x + width - m} y2={split} />
    </g>
  );
}

/** Hood insert strip along the bottom of the upper cabinet above the range. */
function HoodGlyph({ x, y, width, height, stroke }: GlyphBox) {
  const m = 3;
  const stripTop = y + height - Math.min(height * 0.3, 15);
  return (
    <g data-appliance-role="hood" stroke={stroke} strokeWidth="1.1" fill="none">
      <line x1={x + m} y1={stripTop} x2={x + width - m} y2={stripTop} />
      <rect
        x={x + width * 0.24}
        y={(stripTop + y + height) / 2 - 2}
        width={width * 0.52}
        height={4}
      />
    </g>
  );
}
