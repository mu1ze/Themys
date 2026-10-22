import { copyFile, mkdir, writeFile } from "node:fs/promises";

// esbuild reads the nearest tsconfig for generated server files. The app's
// Next.js aliases can point into the original node_modules tree, bypassing
// OpenNext's runtime patches and pulling native Sharp into the Worker.
// Keep those aliases for application typechecking and isolate the generated
// bundle with its own config. OpenNext clears this directory before building.
await mkdir(".open-next", { recursive: true });
await writeFile(
  ".open-next/tsconfig.json",
  `${JSON.stringify({ compilerOptions: {} }, null, 2)}\n`,
);

// Typecheck the handwritten Worker boundary without inferring the enormous
// generated JavaScript bundle, which can overflow TypeScript's flow analysis.
await copyFile(
  new URL("../types/open-next-worker.d.ts", import.meta.url),
  ".open-next/worker.d.ts",
);
