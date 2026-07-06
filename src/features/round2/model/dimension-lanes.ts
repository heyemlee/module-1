// Dimension-chain labels overlap when neighboring segments are narrow
// ("27″36″", "36″24″" run together). Wide segments keep the default lane 0;
// narrow segments drop to staggered lanes 1/2, alternating so two adjacent
// narrow labels never share a row. Used by the proposal elevation and the
// A-series drawing sheets.

export function assignDimensionLanes(
  widthsPx: readonly number[],
  minWidthPx: number
): number[] {
  let previousStagger = 2;
  return widthsPx.map((width) => {
    if (width >= minWidthPx) {
      previousStagger = 2;
      return 0;
    }
    previousStagger = previousStagger === 1 ? 2 : 1;
    return previousStagger;
  });
}
