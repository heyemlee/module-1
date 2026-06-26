"use client";

import { useState } from "react";

/**
 * Decorative login flourish (exact port of the handoff design's `fanCards`): a
 * fanned stack of cabinet-finish cards that splay on hover. Pure presentation —
 * no app state, no side effects.
 */

const FAN = [
  { rot: -22, x: -92, y: 24, sc: 0.74, z: 1 },
  { rot: -15, x: -63, y: 13, sc: 0.83, z: 2 },
  { rot: -7, x: -32, y: 4.5, sc: 0.92, z: 3 },
  { rot: 0, x: 0, y: 0, sc: 1, z: 10 },
  { rot: 7, x: 32, y: 4.5, sc: 0.92, z: 3 },
  { rot: 15, x: 63, y: 13, sc: 0.83, z: 2 },
  { rot: 22, x: 92, y: 24, sc: 0.74, z: 1 }
];

const FIN = [
  { name: "MATTE WHITE", tone: "#f3f3f1" },
  { name: "BONE", tone: "#e7e4dd" },
  { name: "PEBBLE GREY", tone: "#bdbdb9" },
  {
    name: "BRUSHED STEEL",
    tone: "repeating-linear-gradient(90deg,#a6a6a3 0 3px,#c6c6c3 3px 6px)"
  },
  { name: "GRAPHITE", tone: "linear-gradient(150deg,#54545a,#2a2a2e)" },
  { name: "SLATE", tone: "#71716e" },
  { name: "ONYX", tone: "linear-gradient(150deg,#26262a,#0e0e10)" }
];

export function LoginShowpiece() {
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div
      aria-hidden
      className="relative select-none"
      style={{ height: 171, width: 522 }}
      onMouseLeave={() => setHover(null)}
    >
      {FIN.map((finish, i) => {
        let { x, y, rot, sc, z } = FAN[i];
        if (hover != null) {
          const d = Math.abs(i - hover);
          if (i === hover) {
            y -= 20;
            sc *= 1.1;
            z = 20;
          } else if (d > 0) {
            const dir = i < hover ? -1 : 1;
            x += dir * (13 / d);
            rot += dir * (2.5 / d);
          }
        }
        return (
          <div
            key={finish.name}
            onMouseEnter={() => setHover(i)}
            className="absolute cursor-pointer overflow-hidden"
            style={{
              left: "50%",
              top: "50%",
              width: 76,
              height: 124,
              margin: "-62px 0 0 -38px",
              borderRadius: 13,
              background: finish.tone,
              boxShadow:
                "0 1px 0 rgba(255,255,255,.4) inset,0 16px 32px -14px rgba(20,20,26,.5)",
              transform: `translate(${x}px,${y}px) rotate(${rot}deg) scale(${sc})`,
              zIndex: z,
              transition: "transform .55s cubic-bezier(.2,.85,.3,1.12)"
            }}
          >
            <span
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(150deg,rgba(255,255,255,.5),transparent 42%)"
              }}
            />
            <span
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg,transparent 58%,rgba(10,10,12,.22))"
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
