import { formatSixteenths } from "../model/round2-model";
import { measureDimensionLabel } from "../model/dimension-lanes";

export const DRAFT_DIMENSION_COLOR = "#079ca5";
export const DRAFT_DIMENSION_FONT_SIZE = 11;
export const DRAFT_DIMENSION_STROKE_WIDTH = 2;

const FRACTION_FONT_SIZE = 7;

export type DimensionParts = {
  whole: string;
  numerator: string | null;
  denominator: string | null;
  label: string;
};

/** Breaks a sixteenth-inch value into the drafting-style whole and fraction. */
export function dimensionParts(
  value: number | null | undefined
): DimensionParts {
  const label = formatSixteenths(value);
  if (value == null) {
    return { whole: label, numerator: null, denominator: null, label };
  }

  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const inches = Math.floor(absolute / 16);
  const numerator = absolute % 16;
  if (numerator === 0) {
    return {
      whole: `${sign}${inches}″`,
      numerator: null,
      denominator: null,
      label
    };
  }

  const [fractionNumerator, fractionDenominator] = formatSixteenths(numerator)
    .replace("″", "")
    .split("/");
  return {
    whole: inches === 0 ? sign : `${sign}${inches}`,
    numerator: fractionNumerator ?? null,
    denominator: fractionDenominator ?? null,
    label
  };
}

/** Width of the actual drafting glyphs, including the compact stacked fraction. */
export function dimensionLabelWidth(
  value: number | null | undefined
): number {
  const parts = dimensionParts(value);
  if (!parts.numerator || !parts.denominator) {
    return measureDimensionLabel(parts.whole, DRAFT_DIMENSION_FONT_SIZE);
  }
  return stackedDimensionMetrics(parts).totalWidth;
}

/** White knockout band used to center a value directly on its dimension rule. */
export function dimensionBackdropBand(
  parts: DimensionParts
): { top: number; height: number } {
  return parts.numerator && parts.denominator
    ? { top: -9, height: 18 }
    : { top: -8, height: 12 };
}

export function dimensionLabelSpan(
  value: number | null | undefined
): number {
  return dimensionLabelWidth(value) + 4;
}

function stackedDimensionMetrics(parts: DimensionParts) {
  const wholeWidth =
    parts.whole.length * DRAFT_DIMENSION_FONT_SIZE * 0.62;
  const fractionWidth =
    Math.max(parts.numerator?.length ?? 0, parts.denominator?.length ?? 0) *
      FRACTION_FONT_SIZE *
      0.62 +
    2;
  const quoteWidth = DRAFT_DIMENSION_FONT_SIZE * 0.45;
  const totalWidth =
    wholeWidth +
    (wholeWidth > 0 ? 1.5 : 0) +
    fractionWidth +
    1.5 +
    quoteWidth;
  return { wholeWidth, fractionWidth, totalWidth };
}

/**
 * Shared elevation / floor-plan dimension value. The label is centered on the
 * rule, its white backdrop punches out the line beneath it, and fractions use
 * a numerator/bar/denominator stack without an extra slash glyph.
 */
export function DraftDimensionValue({
  value,
  x,
  y,
  vertical = false,
  rotation,
  attribute,
  id,
  className
}: {
  value: number | null | undefined;
  x: number;
  y: number;
  vertical?: boolean;
  rotation?: -90 | 90;
  attribute?: `data-${string}`;
  id?: string;
  className?: string;
}) {
  const parts = dimensionParts(value);
  const data = attribute && id ? { [attribute]: id } : {};
  const angle = rotation ?? (vertical ? -90 : undefined);
  const transform = angle == null ? undefined : `rotate(${angle} ${x} ${y})`;
  const backdrop = dimensionBackdropBand(parts);

  if (!parts.numerator || !parts.denominator) {
    const width = measureDimensionLabel(
      parts.whole,
      DRAFT_DIMENSION_FONT_SIZE
    );
    return (
      <>
        <rect
          data-dimension-label-backdrop="true"
          x={x - width / 2 - 2}
          y={y + backdrop.top}
          width={width + 4}
          height={backdrop.height}
          transform={transform}
          fill="#ffffff"
          stroke="none"
        />
        <text
          {...data}
          data-dimension-value={parts.label}
          x={x}
          y={y}
          textAnchor="middle"
          fontFamily="var(--studio-mono)"
          fontSize={DRAFT_DIMENSION_FONT_SIZE}
          fontWeight="bold"
          stroke="none"
          fill={DRAFT_DIMENSION_COLOR}
          transform={transform}
          className={className}
        >
          {parts.whole}
        </text>
      </>
    );
  }

  const { wholeWidth, fractionWidth, totalWidth } =
    stackedDimensionMetrics(parts);
  const wholeX = x - totalWidth / 2;
  const fractionX = wholeX + wholeWidth + (wholeWidth > 0 ? 1.5 : 0);
  const fractionCenter = fractionX + fractionWidth / 2;
  const quoteX = fractionX + fractionWidth + 1.5;

  return (
    <>
      <rect
        data-dimension-label-backdrop="true"
        x={x - totalWidth / 2 - 2}
        y={y + backdrop.top}
        width={totalWidth + 4}
        height={backdrop.height}
        transform={transform}
        fill="#ffffff"
        stroke="none"
      />
      <line
        data-dimension-fraction-bar="true"
        x1={fractionX}
        x2={fractionX + fractionWidth}
        y1={y - 1}
        y2={y - 1}
        transform={transform}
        stroke={DRAFT_DIMENSION_COLOR}
        strokeWidth="0.75"
      />
      <text
        {...data}
        data-dimension-value={parts.label}
        x={x}
        y={y}
        fontFamily="var(--studio-mono)"
        fontSize={DRAFT_DIMENSION_FONT_SIZE}
        fontWeight="bold"
        stroke="none"
        fill={DRAFT_DIMENSION_COLOR}
        transform={transform}
        className={className}
        aria-label={parts.label}
      >
        {parts.whole && (
          <tspan x={wholeX} y={y} textAnchor="start">
            {parts.whole}
          </tspan>
        )}
        <tspan
          data-dimension-numerator="true"
          x={fractionCenter}
          y={y - 4}
          textAnchor="middle"
          fontSize={FRACTION_FONT_SIZE}
        >
          {parts.numerator}
        </tspan>
        <tspan
          data-dimension-denominator="true"
          x={fractionCenter}
          y={y + 6}
          textAnchor="middle"
          fontSize={FRACTION_FONT_SIZE}
        >
          {parts.denominator}
        </tspan>
        <tspan x={quoteX} y={y} textAnchor="start">
          ″
        </tspan>
      </text>
    </>
  );
}
