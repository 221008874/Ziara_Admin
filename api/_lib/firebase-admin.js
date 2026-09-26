/**
 * Domain-scoped Firebase Admin SDK access.
 *
 * WHY THIS EXISTS
 * ---------------
 * The admin panel used to carry a single credential, `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`,
 * and every handler copy-pasted the same `initializeApp()` block for it. That credential
 * was therefore serving BOTH Firebase projects at once:
 *
 *   - smartclinicadmin (Community + this panel): servers, saas_*, sync_failures, Auth users
 *   - ziara-erp-wep    (ERP):                   inventory_*, purchase_orders, goods_receipts
 *
 * That is the cross-tenant hazard: one leaked/reused key has write access to both the
 * clinical hub and the ERP, and nothing stopped a handler from silently writing ERP rows
 * into the Community project (or vice versa) if the var was pointed at the wrong project.
 * Every handler also swallowed its init error with `console.error` and continued, so a
 * missing or wrong credential surfaced much later as an opaque Firestore error.
 *
 * WHAT THIS DOES
 * --------------
 * Each handler declares which project it is allowed to touch, and this module:
 *   1. resolves a credential that is dedicated to that domain,
 *   2. asserts the credential's `project_id` is the one expected for that domain,
 *   3. fails loudly and immediately when it is not (no silent fallback to another project),
 *   4. gives each project its own NAMED admin app, so `getFirestore()`/`getAuth()` can
 *      never accidentally resolve to the wrong project's default app.
 *
 * Token verification is pinned to the Community project: the panel's own users sign in
 * through `src/firebase.js` (smartclinicadmin), so an ID token minted there will not
 * verify against a different project's admin app. See src/lib/auth-middleware.js.
 */
import fs from 'node:fs';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/** Community/Admin Panel project. */
export const COMMUNITY = 'community';
/** ERP project. */
export const ERP = 'erp';

/**
 * Kept only as a migration aid: the old shared credential. It is accepted ONLY if its
 * project_id matches the domain being initialised, so it can never be used to reach
 * across the boundary. Migrate to the per-domain vars and this disappears.
 */
const LEGACY_VAR = 'FIREBASE_SERVICE_ACCOUNT_JSON_BASE64';

const DOMAINS = {
  [COMMUNITY]: {
    appName: 'community-smartclinicadmin',
    projectId: 'smartclinicadmin',
    label: 'Community/Admin Panel',
    b64Var: 'COMMUNITY_FIREBASE_SERVICE_ACCOUNT_B64',
    pathVar: 'COMMUNITY_FIREBASE_SERVICE_ACCOUNT_PATH',
  },
  [ERP]: {
    appName: 'erp-ziara-erp-wep',
    projectId: 'ziara-erp-wep',
    label: 'ERP',
    b64Var: 'ERP_FIREBASE_SERVICE_ACCOUNT_B64',
    pathVar: 'ERP_FIREBASE_SERVICE_ACCOUNT_PATH',
  },
};

const cache = new Map();

function assertServiceAccount(sa, source) {
  if (!sa || typeof sa !== 'object') {
    throw new Error(`Credential from ${source} is not a JSON object`);
  }
  for (const field of ['project_id', 'client_email', 'private_key']) {
    if (!sa[field]) {
      throw new Error(`Credential from ${source} is missing "${field}"`);
    }
  }
  if (!String(sa.private_key).includes('PRIVATE KEY')) {
    // Catches a base64 payload that decoded to the wrong thing entirely.
    throw new Error(`Credential from ${source} has a malformed "private_key"`);
  }
  return sa;
}

function loadServiceAccount(cfg) {
  const b64 = process.env[cfg.b64Var];
  if (b64 && b64.length > 20) {
    let parsed;
    try {
      parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
    } catch (err) {
      throw new Error(`${cfg.b64Var} is not valid base64-encoded JSON: ${err.message}`);
    }
    return assertServiceAccount(parsed, cfg.b64Var);
  }

  // Path form, matching the ERP repo's local-dev convention.
  const p = process.env[cfg.pathVar];
  if (p) {
    let raw;
    try {
      raw = fs.readFileSync(p, 'utf-8');
    } catch (err) {
      throw new Error(`${cfg.pathVar} could not be read (${p}): ${err.message}`);
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`${cfg.pathVar} is not valid JSON: ${err.message}`);
    }
    return assertServiceAccount(parsed, cfg.pathVar);
  }

  // Migration aid — see LEGACY_VAR. Project id still has to match this domain.
  const legacy = process.env[LEGACY_VAR];
  if (legacy && legacy.length > 20) {
    const parsed = assertServiceAccount(
      JSON.parse(Buffer.from(legacy, 'base64').toString('utf-8')),
      LEGACY_VAR,
    );
    if (parsed.project_id === cfg.projectId) {
      console.warn(
        `[firebase-admin] ${cfg.label}: using legacy shared ${LEGACY_VAR}. ` +
          `Set ${cfg.b64Var} and unset ${LEGACY_VAR}.`,
      );
      return parsed;
    }
  }

  throw new Error(
    `[firebase-admin] No credential for ${cfg.label} (${cfg.projectId}). ` +
      `Set ${cfg.b64Var} (base64 service account JSON) or ${cfg.pathVar} (file path). ` +
      `Refusing to start rather than risk touching the wrong Firebase project.`,
  );
}

/** Initialise (once) and return the named admin app for a domain. */
export function getDomainApp(domain) {
  const cfg = DOMAINS[domain];
  if (!cfg) {
    throw new Error(`Unknown Firebase domain "${domain}". Use ${COMMUNITY} or ${ERP}.`);
  }
  if (cache.has(domain)) {
    return cache.get(domain);
  }

  const existing = getApps().find((a) => a.name === cfg.appName);
  if (existing) {
    // A named app can only exist if we created it, but re-assert anyway: this is
    // the boundary that stops an ERP handler from writing into the clinic hub.
    const bound = existing.options.projectId;
    if (bound !== cfg.projectId) {
      throw new Error(
        `[firebase-admin] ${cfg.label} app is bound to project "${bound}" but this ` +
          `handler may only touch "${cfg.projectId}". Refusing to continue.`,
      );
    }
    cache.set(domain, existing);
    return existing;
  }

  // The credential's own project_id is the authoritative check. Do NOT rely on
  // app.options.projectId for this: firebase-admin only populates that when
  // `projectId` is passed in the options, so it is undefined here and a check
  // against it silently passes for ANY credential.
  const serviceAccount = loadServiceAccount(cfg);
  if (serviceAccount.project_id !== cfg.projectId) {
    throw new Error(
      `[firebase-admin] ${cfg.label} credential belongs to project ` +
        `"${serviceAccount.project_id}" (${serviceAccount.client_email}) but this handler ` +
        `may only touch "${cfg.projectId}". Refusing to continue rather than ` +
        `${cfg.label === 'ERP' ? 'write ERP rows into the clinic project' : 'read clinic data from the ERP project'}.`,
    );
  }

  const app = initializeApp(
    { credential: cert(serviceAccount), projectId: cfg.projectId },
    cfg.appName,
  );

  cache.set(domain, app);
  return app;
}

/** Firestore handle for a domain. */
export function getDb(domain) {
  return getFirestore(getDomainApp(domain));
}

/** Admin Auth handle for a domain. */
export function getAdminAuth(domain) {
  return getAuth(getDomainApp(domain));
}

/** Diagnostic helper: which credential each configured domain resolved to. */
export function describeDomains() {
  return Object.entries(DOMAINS).map(([domain, cfg]) => {
    let resolved = 'not initialised';
    try {
      const app = getDomainApp(domain);
      resolved = app.options.projectId || cfg.projectId;
    } catch (err) {
      resolved = `unavailable: ${err.message}`;
    }
    return { domain, label: cfg.label, expected: cfg.projectId, resolved };
  });
}
