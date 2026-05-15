#!/usr/bin/env node
/**
 * After `next build`, the `.next/standalone/` tree is a self-contained
 * Node server, but Next.js does NOT automatically copy `.next/static/`
 * (compiled CSS/JS bundles) or `public/` into it. Without those files
 * the standalone server 404s on every `/_next/static/...` request and
 * the site renders unstyled.
 *
 * See: https://nextjs.org/docs/app/api-reference/next-config-js/output#automatically-copying-traced-files
 */

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");
const standaloneWebRoot = resolve(webRoot, ".next/standalone/packages/web");

if (!existsSync(standaloneWebRoot)) {
  console.error(
    `[copy-standalone-assets] standalone output not found at ${standaloneWebRoot}. ` +
      `Run \`next build\` with \`output: "standalone"\` first.`,
  );
  process.exit(1);
}

const copies = [
  {
    from: resolve(webRoot, ".next/static"),
    to: resolve(standaloneWebRoot, ".next/static"),
    label: ".next/static",
  },
  {
    from: resolve(webRoot, "public"),
    to: resolve(standaloneWebRoot, "public"),
    label: "public",
    optional: true,
  },
];

for (const { from, to, label, optional } of copies) {
  if (!existsSync(from)) {
    if (optional) {
      console.log(`[copy-standalone-assets] skipping ${label} (not present)`);
      continue;
    }
    console.error(`[copy-standalone-assets] missing required source: ${from}`);
    process.exit(1);
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, force: true });
  console.log(`[copy-standalone-assets] copied ${label} -> ${to}`);
}
