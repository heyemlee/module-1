# Width-chain extension lines

## Purpose

Make every horizontal cabinet-width dimension easier to read by lengthening the short perpendicular extension lines at both ends of its guide.

## Scope

- Apply the same longer endpoint extension to the overall wall-width chain, ordinary cabinet and opening width chains, corner-return width chains, and corner-breakdown width chains.
- Preserve every guide's horizontal span, label position, dimension value, stroke colour, and stroke width.
- Do not change vertical height dimensions or cabinet geometry.

## Design

Introduce a shared SVG-unit constant for horizontal width-chain endpoint extension length, with a value of 8. Existing endpoint strokes are 4 SVG units; doubling them makes the brackets conspicuous without reaching the nearest cabinet geometry or label rows. For a chain above cabinets, the endpoints extend downward from its guide; for a chain below cabinets, they extend upward.

## Testing

The existing server-rendered elevation test suite will assert that representative above and below width-chain SVG paths use the shared 8-unit endpoint extension. This protects ordinary and corner-generated dimensions while leaving the total dimension guide consistent.
