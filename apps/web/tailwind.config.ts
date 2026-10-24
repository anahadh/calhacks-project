import type { Config } from "tailwindcss";

// Colors from the spec's Design Language. State colors (healthy, infected,
// delayed, disrupted, zone) are only for devices, patients, arcs, zones and
// spread effects. Chrome uses the neutral `ink` scale.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0F14",
        surface: "#11161D",
        raised: "#171D26",
        line: "#222A35",
        ink: {
          DEFAULT: "#E8ECF1",
          muted: "#9AA4B2",
          faint: "#5F6A79",
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
        sans: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
