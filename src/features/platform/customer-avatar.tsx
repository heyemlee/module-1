/**
 * Self-contained cartoon customer avatars (inline SVG — no external requests).
 * Ten distinct presets are cycled per row in place of the handoff's stock
 * photos. Pure presentation.
 */

type AvatarStyle = "short" | "long" | "curly" | "bun" | "side" | "bald" | "cap";

type AvatarPreset = {
  bg: string;
  skin: string;
  hair: string;
  shirt: string;
  style: AvatarStyle;
  glasses?: boolean;
};

const PRESETS: AvatarPreset[] = [
  { bg: "#e7e4dd", skin: "#f1c9a5", hair: "#2b2b2e", shirt: "#6b7280", style: "short" },
  { bg: "#dde7e4", skin: "#d99a6c", hair: "#4a3527", shirt: "#5a8a7a", style: "long" },
  { bg: "#e7e0e9", skin: "#e8b48c", hair: "#5a3826", shirt: "#8a6f9e", style: "curly" },
  { bg: "#dfe6ec", skin: "#c68642", hair: "#2b2b2e", shirt: "#4f6b8a", style: "bun" },
  { bg: "#ece5dc", skin: "#f6d3b0", hair: "#d6a85f", shirt: "#c08552", style: "side", glasses: true },
  { bg: "#e0e7df", skin: "#a86b3c", hair: "#2b2b2e", shirt: "#5f7a5f", style: "short" },
  { bg: "#ece3e2", skin: "#eab98f", hair: "#9a9a96", shirt: "#7a5f5f", style: "bald" },
  { bg: "#e8e6de", skin: "#8d5524", hair: "#241c18", shirt: "#b5704f", style: "curly" },
  { bg: "#dfe7ea", skin: "#f1c9a5", hair: "#b5503a", shirt: "#4f6b8a", style: "long", glasses: true },
  { bg: "#eae5dc", skin: "#d99a6c", hair: "#3a3a3c", shirt: "#6b7280", style: "cap" }
];

function HairBack({ style, color }: { style: AvatarStyle; color: string }) {
  if (style === "long") {
    return (
      <g fill={color}>
        <path d="M10 14 C9 20 9.5 25 11.5 29 L14 28 C12.5 23 12.5 18 13.5 14.5 Z" />
        <path d="M30 14 C31 20 30.5 25 28.5 29 L26 28 C27.5 23 27.5 18 26.5 14.5 Z" />
      </g>
    );
  }
  if (style === "bun") return <circle cx="20" cy="7.4" r="3.6" fill={color} />;
  if (style === "bald") {
    return (
      <path
        fill={color}
        d="M10.5 17 C10.5 21 11.5 24.5 13.5 27 L14.6 26 C12.9 22.4 12.6 18.6 13.2 15.8 Z M29.5 17 C29.5 21 28.5 24.5 26.5 27 L25.4 26 C27.1 22.4 27.4 18.6 26.8 15.8 Z"
      />
    );
  }
  return null;
}

function HairFront({ style, color }: { style: AvatarStyle; color: string }) {
  switch (style) {
    case "bald":
    case "cap":
      return null;
    case "curly":
      return (
        <g fill={color}>
          <circle cx="12.5" cy="14.5" r="3" />
          <circle cx="14.5" cy="11" r="3.4" />
          <circle cx="18" cy="8.8" r="3.7" />
          <circle cx="22" cy="8.7" r="3.7" />
          <circle cx="25.5" cy="10.5" r="3.4" />
          <circle cx="27.5" cy="14" r="3" />
        </g>
      );
    case "long":
      return (
        <path
          fill={color}
          d="M11 15 C10 6.5 30 6.5 29 15 C26.5 11.5 23.5 10 20 10 C16.5 10 13.5 11.5 11 15 Z"
        />
      );
    case "bun":
      return (
        <path
          fill={color}
          d="M11.6 14.5 C12 8.5 28 8.5 28.4 14.5 C26 11.5 14 11.5 11.6 14.5 Z"
        />
      );
    case "side":
      return (
        <path
          fill={color}
          d="M11 15.5 C10.4 6.5 29.6 6.5 29 13.5 C26.5 10.5 23 9.5 20 9.5 C16.5 9.5 13 11 12 16.5 Z"
        />
      );
    default:
      return (
        <path
          fill={color}
          d="M11 15 C10 6.5 30 6.5 29 15 C26.5 11.5 23.5 10 20 10 C16.5 10 13.5 11.5 11 15 Z"
        />
      );
  }
}

export function CustomerAvatar({
  index,
  className
}: {
  index: number;
  className?: string;
}) {
  const preset = PRESETS[index % PRESETS.length];
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="40" height="40" fill={preset.bg} />
      <path
        d="M4 40 C4 32 11 28 20 28 C29 28 36 32 36 40 Z"
        fill={preset.shirt}
      />
      <rect x="16.5" y="22" width="7" height="6" rx="2.4" fill={preset.skin} />
      <HairBack style={preset.style} color={preset.hair} />
      <circle cx="20" cy="16" r="9" fill={preset.skin} />
      {preset.style === "cap" ? (
        <g fill={preset.hair}>
          <path d="M10.4 15 C10.4 7.5 29.6 7.5 29.6 15 Z" />
          <rect x="8.8" y="14" width="22.4" height="2.7" rx="1.35" />
        </g>
      ) : (
        <HairFront style={preset.style} color={preset.hair} />
      )}
      <circle cx="16.8" cy="16.2" r="1.15" fill="#2b2b2e" />
      <circle cx="23.2" cy="16.2" r="1.15" fill="#2b2b2e" />
      <path
        d="M17.3 19.7 Q20 21.9 22.7 19.7"
        stroke="#2b2b2e"
        strokeWidth="1.05"
        fill="none"
        strokeLinecap="round"
      />
      {preset.glasses && (
        <g stroke="#2b2b2e" strokeWidth="0.9" fill="none">
          <circle cx="16.8" cy="16.2" r="2.5" />
          <circle cx="23.2" cy="16.2" r="2.5" />
          <path d="M19.3 16.2 h1.4" />
        </g>
      )}
    </svg>
  );
}
