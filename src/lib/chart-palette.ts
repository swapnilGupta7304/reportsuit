// Shared colorful palette for the analytics dashboard.
// Hex values are intentionally explicit (per product spec) so charts pop
// consistently across light/dark themes.

export const PALETTE = {
  orange: "#ff6b00",
  blue: "#2563eb",
  purple: "#7c3aed",
  green: "#22c55e",
  pink: "#ec4899",
  yellow: "#f59e0b",
  cyan: "#06b6d4",
  red: "#ef4444",
  indigo: "#6366f1",
  teal: "#14b8a6",
} as const;

export const PALETTE_LIST = [
  PALETTE.orange,
  PALETTE.blue,
  PALETTE.purple,
  PALETTE.green,
  PALETTE.pink,
  PALETTE.yellow,
  PALETTE.cyan,
  PALETTE.indigo,
  PALETTE.teal,
  PALETTE.red,
];

export const CHANNEL_COLORS: Record<string, string> = {
  "Organic Search": PALETTE.green,
  Direct: PALETTE.orange,
  Referral: PALETTE.blue,
  "Organic Social": PALETTE.purple,
  "Paid Search": PALETTE.pink,
  "Organic Video": PALETTE.yellow,
  Email: PALETTE.cyan,
  Unassigned: "#94a3b8",
};

export const DEVICE_COLORS: Record<string, string> = {
  mobile: PALETTE.orange,
  desktop: PALETTE.blue,
  tablet: PALETTE.purple,
  smart_tv: PALETTE.green,
};

export const OS_COLORS: Record<string, string> = {
  Android: PALETTE.green,
  iOS: PALETTE.blue,
  Windows: PALETTE.cyan,
  Macintosh: PALETTE.purple,
  Linux: PALETTE.yellow,
  "Chrome OS": PALETTE.orange,
};

export function colorFor(key: string, map: Record<string, string>, fallbackIdx = 0) {
  return map[key] ?? PALETTE_LIST[fallbackIdx % PALETTE_LIST.length];
}

export const TOOLTIP_STYLE = {
  background: "hsl(var(--card, 0 0% 100%))",
  border: "1px solid hsl(var(--border, 220 13% 91%))",
  borderRadius: 12,
  boxShadow: "0 10px 30px -10px rgba(0,0,0,0.15)",
  fontSize: 12,
  padding: "8px 12px",
} as const;
