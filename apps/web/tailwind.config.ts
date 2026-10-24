import type { Config } from "tailwindcss";

// Tokens from the Hippocra.tech design system (graphite theme).
// Chrome is monochrome: `accent` is ink, not a hue, so selection never reads as a state.
// State colors (monitor traces) appear only on devices, patients, arcs, zones and spread effects.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0D0F10",
        panel: "#131618",
        panel2: "#1A1D20",
        line: "#24282B",
        line2: "#3E4448",
        ink: {
          DEFAULT: "#E9ECEE",
          muted: "#A1A8AE",
          faint: "#7D858B",
        },
        // Monochrome selection. `accent` stays as the class name components already use.
        accent: {
          DEFAULT: "#E9ECEE",
          dim: "#3E4448",
        },
        select: {
          DEFAULT: "#E9ECEE",
          on: "#0D0F10",
          wash: "rgba(233,236,238,0.07)",
        },
        state: {
          healthy: "#4DB0FF",
          infected: "#FF6A2E",
          ok: "#DDE4EA",
          delayed: "#FFC53D",
          disrupted: "#FF4778",
          zone: "#B08CFF",
          cut: "#6B7378",
        },
        scene: {
          ground: "#111315",
          slab: "#1D2023",
          wall: "#2A2E32",
          edge: "#3C4247",
        },
      },
      fontFamily: {
        sans: ["var(--font-hanken)", "Helvetica Neue", "Arial", "system-ui", "sans-serif"],
        disp: ["var(--font-hanken)", "Helvetica Neue", "Arial", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "Menlo", "monospace"],
      },
      fontSize: {
        "readout-xl": ["72px", { lineHeight: "72px", letterSpacing: "-0.035em", fontWeight: "300" }],
        "readout-l": ["48px", { lineHeight: "48px", letterSpacing: "-0.03em", fontWeight: "300" }],
        "readout-m": ["30px", { lineHeight: "32px", letterSpacing: "-0.02em", fontWeight: "300" }],
        title: ["22px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
        caption: ["10.5px", { lineHeight: "14px", letterSpacing: "0.14em" }],
      },
      borderRadius: {
        ctl: "2px",
        panel: "4px",
      },
      boxShadow: {
        panel: "none",
        overlay: "0 0 0 1px #3E4448, 0 24px 64px rgba(0,0,0,0.55)",
      },
      transitionDuration: {
        heartbeat: "1000ms",
        flash: "600ms",
        fade: "400ms",
      },
      transitionTimingFunction: {
        breath: "cubic-bezier(0.37, 0, 0.63, 1)",
        travel: "cubic-bezier(0.45, 0, 0.55, 1)",
        settle: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      opacity: {
        disabled: "0.4",
      },
    },
  },
  plugins: [],
};

export default config;
