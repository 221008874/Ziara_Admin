// firebase-admin-domains.mjs - regression tests for the per-project Admin SDK
// credential split (see api/_lib/firebase-admin.js).
//
// Run: node tests/firebase-admin-domains.mjs
//
// These guard a security boundary: a handler authorised for one Firebase project
// must never be able to use the other project's credential. The original defect
// was a single FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 serving both projects, with
// every handler swallowing its init error.
//
// Each credential case runs in a child process because the module memoises the
// initialised app and firebase-admin keeps process-global app state.

// ─── Tiny test framework ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label, detail) {
  if (condition) {
    console.log("  PASS  " + label);
    passed++;
  } else {
    console.log("  FAIL  " + label);
    if (detail) console.log("        " + detail);
    failed++;
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const LIB_URL = new URL("../api/_lib/firebase-admin.js", import.meta.url).href;

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

// A structurally valid service account. `cert()` only needs a parseable PEM, and
// initializeApp does not authenticate, so nothing here touches the network.
const serviceAccount = (projectId) =>
  JSON.stringify({
    type: "service_account",
    project_id: projectId,
    private_key: privateKey,
    client_email: `tester@${projectId}.iam.gserviceaccount.com`,
    client_id: "1",
    token_uri: "https://oauth2.googleapis.com/token",
  });

const b64 = (value) => Buffer.from(value).toString("base64");

/** Runs `expr` in a child process with only the given Firebase env vars set. */
function runWithEnv(env, expr) {
  const childEnv = { ...process.env };
  for (const key of Object.keys(childEnv)) {
    if (/FIREBASE_SERVICE_ACCOUNT/.test(key)) delete childEnv[key];
  }
  Object.assign(childEnv, env);

  const script = `
    import { getDb, describeDomains, COMMUNITY, ERP } from ${JSON.stringify(LIB_URL)};
    const out = (() => { ${expr} })();
    console.log("__RESULT__" + JSON.stringify(out));
  `;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    env: childEnv,
    encoding: "utf-8",
  });
  if (r.status !== 0) {
    const err = (r.stderr || "").split("\n").find((l) => l.includes("Error")) || "child failed";
    return { crashed: true, error: err.trim() };
  }
  const line = (r.stdout || "").split("\n").find((l) => l.startsWith("__RESULT__"));
  if (!line) return { crashed: true, error: "no result from child" };
  try {
    return JSON.parse(line.slice("__RESULT__".length));
  } catch (e) {
    return { crashed: true, error: "unparseable result: " + e.message };
  }
}

const COMMUNITY_KEY = { COMMUNITY_FIREBASE_SERVICE_ACCOUNT_B64: b64(serviceAccount("smartclinicadmin")) };
const ERP_KEY = { ERP_FIREBASE_SERVICE_ACCOUNT_B64: b64(serviceAccount("ziara-erp-wep")) };

// ─── 1. Credential resolution ─────────────────────────────────────────────────

console.log("\n── credential resolution ─────────────────────────────────────────");

{
  const r = runWithEnv(COMMUNITY_KEY, "return { ok: !!getDb(COMMUNITY) };");
  assert(!r.crashed && r.ok === true, "community credential resolves for the COMMUNITY domain",
    r.crashed ? r.error : JSON.stringify(r));
}

{
  const r = runWithEnv(ERP_KEY, "return { ok: !!getDb(ERP) };");
  assert(!r.crashed && r.ok === true, "ERP credential resolves for the ERP domain",
    r.crashed ? r.error : JSON.stringify(r));
}

// The core of the fix: a credential for the wrong project must be refused.
{
  const r = runWithEnv(
    { ERP_FIREBASE_SERVICE_ACCOUNT_B64: b64(serviceAccount("smartclinicadmin")) },
    "try { getDb(ERP); return { threw: false }; } catch (e) { return { threw: true, msg: e.message }; }",
  );
  assert(r.threw === true, "ERP domain REFUSES the community credential",
    r.crashed ? r.error : JSON.stringify(r));
}

{
  const r = runWithEnv(
    { COMMUNITY_FIREBASE_SERVICE_ACCOUNT_B64: b64(serviceAccount("ziara-erp-wep")) },
    "try { getDb(COMMUNITY); return { threw: false }; } catch (e) { return { threw: true, msg: e.message }; }",
  );
  assert(r.threw === true, "COMMUNITY domain REFUSES the ERP credential",
    r.crashed ? r.error : JSON.stringify(r));
}

{
  const r = runWithEnv({}, "try { getDb(ERP); return { threw: false }; } catch (e) { return { threw: true, msg: e.message }; }");
  assert(r.threw === true, "missing credential fails loudly instead of degrading silently",
    r.crashed ? r.error : JSON.stringify(r));
}

{
  const r = runWithEnv(
    { FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: b64(serviceAccount("ziara-erp-wep")) },
    `let erp; try { getDb(ERP); erp = 'resolved'; } catch { erp = 'refused'; }
     let community; try { getDb(COMMUNITY); community = 'resolved'; } catch { community = 'refused'; }
     return { erp, community };`,
  );
  assert(
    !r.crashed && r.erp === "resolved" && r.community === "refused",
    "legacy shared var serves only the domain whose project_id it matches",
    r.crashed ? r.error : JSON.stringify(r),
  );
}

{
  const r = runWithEnv(
    { ERP_FIREBASE_SERVICE_ACCOUNT_B64: b64('{"project_id":"ziara-erp-wep"}') },
    "try { getDb(ERP); return { threw: false }; } catch (e) { return { threw: true, msg: e.message }; }",
  );
  assert(r.threw === true, "credential missing private_key is reported, not ignored",
    r.crashed ? r.error : JSON.stringify(r));
}

{
  const r = runWithEnv(
    { ERP_FIREBASE_SERVICE_ACCOUNT_B64: "not-valid-base64-json" },
    "try { getDb(ERP); return { threw: false }; } catch (e) { return { threw: true, msg: e.message }; }",
  );
  assert(r.threw === true, "undecodable base64 is reported, not ignored",
    r.crashed ? r.error : JSON.stringify(r));
}

{
  const r = runWithEnv(
    { ...COMMUNITY_KEY, ...ERP_KEY },
    "getDb(COMMUNITY); getDb(ERP); return { domains: describeDomains().map(d => d.domain + '=' + d.resolved) };",
  );
  const d = r.domains || [];
  assert(
    !r.crashed && d.includes("community=smartclinicadmin") && d.includes("erp=ziara-erp-wep"),
    "both domains initialise independently and stay distinct",
    r.crashed ? r.error : JSON.stringify(r),
  );
}

// ─── 2. Handler domain/collection consistency ─────────────────────────────────

console.log("\n── handler domain consistency ────────────────────────────────────");

// Collections owned by the ERP project (from the ERP repo's modules/inventory and
// modules/procurement repositories).
const ERP_OWNED = [
  "inventory_items", "inventory_movements", "inventory_adjustments",
  "inventory_audit_log", "inventory_stock_counts",
  "purchase_orders", "purchase_order_items",
  "goods_receipts", "goods_receipt_items", "procurement_audit_log",
];

// Collections owned by the Community/Admin project.
const COMMUNITY_OWNED = [
  "servers", "saas_otp_requests", "saas_rate_limits", "saas_settings",
  "platform_admins", "sync_failures", "sync_queue", "saas_licenses",
  "comm_appointments", "comm_patients", "comm_doctors", "app_versions",
];

const fs2 = fs;
const path2 = path;

const handlers = [];
for (const dir of ["api/admin", "api/sync"]) {
  const abs = path2.join(ROOT, dir);
  if (!fs2.existsSync(abs)) continue;
  for (const f of fs2.readdirSync(abs)) if (f.endsWith(".js")) handlers.push(`${dir}/${f}`);
}
handlers.sort();

assert(handlers.length > 0, "API handlers were discovered", "looked in api/admin and api/sync");

for (const h of handlers) {
  const src = fs2.readFileSync(path2.join(ROOT, h), "utf-8");
  const m = src.match(/import \{([^}]*)\} from '\.\.\/_lib\/firebase-admin'/);
  if (!m) {
    assert(false, `${h} declares a domain`, "no domain-scoped import from ../_lib/firebase-admin");
    continue;
  }
  const domain = m[1].includes("ERP") ? "ERP" : "COMMUNITY";

  const wrong = [...ERP_OWNED, ...COMMUNITY_OWNED].filter((c) => {
    const touches = src.includes(`'${c}'`) || src.includes(`"${c}"`);
    if (!touches) return false;
    return domain === "ERP" ? COMMUNITY_OWNED.includes(c) : ERP_OWNED.includes(c);
  });

  // Auth users live in the Community project; only that domain may touch them.
  const authWrong = /getAdminAuth\(/.test(src) && domain === "ERP";

  assert(
    wrong.length === 0 && !authWrong,
    `${h.padEnd(40)} [${domain}] touches only its own project`,
    [
      wrong.length ? `wrong-project collections: ${wrong.join(", ")}` : null,
      authWrong ? "uses Identity Toolkit outside the COMMUNITY domain" : null,
    ].filter(Boolean).join("; "),
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log("\n" + "=".repeat(60));
console.log("  RESULTS: " + passed + " passed, " + failed + " failed");
console.log("=".repeat(60));
process.exit(failed > 0 ? 1 : 0);
