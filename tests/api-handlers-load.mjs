// api-handlers-load.mjs - proves every API handler still loads after a refactor.
//
// Run: node tests/api-handlers-load.mjs
//
// Each handler is bundled with rolldown (which is how Vercel builds it, and which
// resolves this project's extensionless relative imports) and then executed with
// valid throwaway credentials for BOTH Firebase projects. It loads without
// touching the network: initializeApp does not authenticate.
//
// This catches the failure modes a plain `npm run build` misses, because the
// bundler happily treats an undefined identifier as a global. During the
// credential split that is exactly how a removed `getAuth` import became a live
// ReferenceError.
//
// SCOPE — what this does and does not prove:
//   catches: syntax errors, missing/unresolvable imports, references to removed
//            bindings at module scope, and a module that throws while initialising
//            its Firebase Admin app (e.g. a wrong-project credential).
//   does NOT catch: undefined identifiers used only inside a request handler's
//            body, because the handler is never invoked. Those are caught by
//            `npm run lint` (eslint no-undef), not here. Keep running both.

import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

let passed = 0;
let failed = 0;

function assert(condition, label, detail) {
  if (condition) {
    console.log("  PASS  " + label);
    passed++;
  } else {
    console.log("  FAIL  " + label);
    if (detail) {
      for (const line of String(detail).split("\n").slice(0, 3)) {
        if (line.trim()) console.log("        " + line.trim());
      }
    }
    failed++;
  }
}

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "clinic-admin-handlers-"));

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const serviceAccount = (projectId) =>
  JSON.stringify({
    type: "service_account",
    project_id: projectId,
    private_key: privateKey,
    client_email: `tester@${projectId}.iam.gserviceaccount.com`,
    client_id: "1",
    token_uri: "https://oauth2.googleapis.com/token",
  });
const b64 = (v) => Buffer.from(v).toString("base64");

// Discover handlers.
const handlers = [];
for (const dir of ["api/admin", "api/sync"]) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) if (f.endsWith(".js")) handlers.push(`${dir}/${f}`);
}
handlers.sort();

assert(handlers.length > 0, "API handlers were discovered", "looked in api/admin and api/sync");
if (handlers.length === 0) process.exit(1);

// The bundler helper. firebase-admin stays external because it resolves protos
// relative to its own __dirname, so bundling it breaks at runtime; our own files
// are bundled, which is what resolves the extensionless imports.
const rolldownEntry = path.join(ROOT, "node_modules", "rolldown", "dist", "index.mjs");
if (!fs.existsSync(rolldownEntry)) {
  console.log("  SKIP  rolldown not installed; cannot bundle handlers");
  process.exit(0);
}
const bundlerPath = path.join(OUT, "bundle.mjs");
fs.writeFileSync(
  bundlerPath,
  `import { rolldown } from ${JSON.stringify(pathToFileURL(rolldownEntry).href)};
import path from 'node:path';
const [entry, out] = process.argv.slice(2);
const b = await rolldown({ input: entry, platform: 'node',
  external: [/^node:/, /^firebase-admin/, /^firebase(\\/|$)/] });
await b.write({ dir: path.dirname(out), format: 'esm', entryFileNames: path.basename(out) });
`,
);

const env = { ...process.env };
for (const k of Object.keys(env)) if (/FIREBASE_SERVICE_ACCOUNT/.test(k)) delete env[k];
Object.assign(env, {
  COMMUNITY_FIREBASE_SERVICE_ACCOUNT_B64: b64(serviceAccount("smartclinicadmin")),
  ERP_FIREBASE_SERVICE_ACCOUNT_B64: b64(serviceAccount("ziara-erp-wep")),
});

const cleanStderr = (s) =>
  (s || "")
    .split("\n")
    .filter((l) => l.trim() && !/DeprecationWarning|trace-deprecation/.test(l))
    .join("\n");

for (const h of handlers) {
  const outDir = path.join(OUT, h.replace(/[\\/]/g, "__"));
  const outFile = path.join(outDir, "index.mjs");

  const bundle = spawnSync(process.execPath, [bundlerPath, path.join(ROOT, h), outFile], {
    encoding: "utf-8",
    cwd: ROOT,
  });
  if (bundle.status !== 0) {
    assert(false, `${h} bundles`, cleanStderr(bundle.stderr));
    continue;
  }

  const run = spawnSync(
    process.execPath,
    ["--input-type=module", "-e",
      `await import(${JSON.stringify(pathToFileURL(outFile).href)}); console.log('__LOADED__');`],
    { env, encoding: "utf-8" },
  );
  const ok = run.status === 0 && (run.stdout || "").includes("__LOADED__");
  assert(ok, `${h} loads`, ok ? null : cleanStderr(run.stderr));
}

fs.rmSync(OUT, { recursive: true, force: true });

console.log("\n" + "=".repeat(60));
console.log("  RESULTS: " + passed + " passed, " + failed + " failed");
console.log("=".repeat(60));
process.exit(failed > 0 ? 1 : 0);
