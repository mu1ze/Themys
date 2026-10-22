import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "cloudflare-env.d.ts",
      "node_modules/**",
      "docs/**",
      "ios/**",
      "**/.next/**",
      "**/.open-next/**",
      "**/.wrangler/**",
      ".kilo/**",
      ".hermes/**",
      ".commandcode/**",
      ".private/**",
    ],
  },
  {
    // eslint-config-next 16.2.11 treats these React Compiler rules as errors.
    // They fire across the existing interior kit; keep them visible as warnings
    // until those components are migrated.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
];

export default config;
