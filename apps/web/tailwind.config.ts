import type { Config } from "tailwindcss";

// Chrome follows the console design template (navy panels, teal accent).
// State colors still come from the spec's Design Language and appear only on
// devices, patients, arcs, zones and spread effects.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0C131C",
        panel: "#14202D",
        panel2: "#1B2A3A",
        line: "#243546",
        line2: "#2F4458",
        ink: {
          DEFAULT: "#E9EEF3",
          muted: "#AAB9C9",
          faint: "#6F8299",
        },
        accent: {
          DEFAULT: "#58C6D8",
          dim: "#2B6775",
        },
        state: {
          healthy: "#5AA9FF",
          infected: "#FF6B3D",
          ok: "#E8ECF1",
          delayed: "#F5B942",
          disrupted: "#FF4D6D",
          zone: "#B79CFF",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Helvetica Neue", "Arial", "system-ui", "sans-serif"],
        disp: ["var(--font-grotesk)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        panel: "10px",
      },
      boxShadow: {
        panel: "0 1px 0 rgba(255,255,255,.03) inset, 0 8px 24px -16px rgba(0,0,0,.9)",
      },
    },
  },
  plugins: [],
};

export default config;
