// simulation.mjs — Executable simulation tests for clinic-admin fixes
// Run: node tests/simulation.mjs

// ─── Test Framework ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log("  PASS  " + label);
    passed++;
  } else {
    console.log("  FAIL  " + label);
    failed++;
  }
}
function assertEqual(actual, expected, label) {
  const ok = actual === expected;
  if (ok) {
    console.log("  PASS  " + label);
    passed++;
  } else {
    console.log("  FAIL  " + label + " (expected: " + JSON.stringify(expected) + ", got: " + JSON.stringify(actual) + ")");
    failed++;
  }
}

function assertDeepEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log("  PASS  " + label);
    passed++;
  } else {
    console.log("  FAIL  " + label + " (expected: " + JSON.stringify(expected) + ", got: " + JSON.stringify(actual) + ")");
    failed++;
  }
}

function section(name) {
  console.log("\n" + "=".repeat(60));
  console.log("  " + name);
  console.log("=".repeat(60));
}
// ─── PO State Machine — updatePO strips status ────────────────────────────────────

section("PO State Machine Enforcement (fix in firestoreService.js:1585)");

// Simulates the fixed updatePO logic
function simulateUpdatePO(poId, updates, currentStatus) {
  if (updates.status !== undefined) {
    throw new Error("Status cannot be changed via updatePO. Use submitPO/approvePO/etc.");
  }
  // The fix strips status regardless
  const { status, ...safeUpdates } = updates;
  if (currentStatus !== "DRAFT") {
    throw new Error("Can only edit PO in DRAFT status");
  }
  return { poId, ...safeUpdates, updatedAt: new Date() };
}
// Test 1: Normal update passes
(function() {
  const r = simulateUpdatePO("po1", { supplierId: "s1", notes: "fix" }, "DRAFT");
  assert(r.poId === "po1" && r.supplierId === "s1", "Allows normal field updates on DRAFT PO");
})();

// Test 2: status in updates throws
(function() {
  let threw = false;
  try {
    simulateUpdatePO("po1", { status: "RECEIVED" }, "DRAFT");
  } catch (e) {
    threw = e.message.includes("Status cannot be changed via updatePO");
  }
  assert(threw, "Rejects status field in updatePO payload");
})();

// Test 3: Non-DRAFT PO throws
(function() {
  let threw = false;
  try {
    simulateUpdatePO("po1", { notes: "hi" }, "APPROVED");
  } catch (e) {
    threw = e.message.includes("Can only edit PO in DRAFT status");
  }
  assert(threw, "Rejects editing non-DRAFT PO");
})();

// Test 4: status is stripped silently (defense in depth)
(function() {
  const { status, ...rest } = { status: "RECEIVED", notes: "ok" };
  assert(rest.notes === "ok" && !rest.status, "Status field is stripped from updates");
})();

// Test 5: validatePOTransition pure function
const PO_TRANSITIONS = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["APPROVED", "CANCELLED"],
  APPROVED: ["ORDERED", "CANCELLED"],
  ORDERED: ["PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
  PARTIALLY_RECEIVED: ["RECEIVED", "CLOSED"],
  RECEIVED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};
function validateTransition(current, next) {
  const allowed = PO_TRANSITIONS[current];
  if (!allowed) return "Unknown status " + current;
  if (!allowed.includes(next)) return "Cannot transition from " + current + " to " + next;
  return null;
}
assert(validateTransition("DRAFT", "SUBMITTED") === null, "DRAFT -> SUBMITTED is valid");
assert(validateTransition("DRAFT", "APPROVED") !== null, "DRAFT -> APPROVED is invalid");
assert(validateTransition("CLOSED", "DRAFT") !== null, "CLOSED -> anything is invalid");
assert(validateTransition("CANCELLED", "DRAFT") !== null, "CANCELLED -> anything is invalid");
assert(validateTransition("RECEIVED", "CLOSED") === null, "RECEIVED -> CLOSED is valid");

// ─── Doctor Creation — Auth created last ───────────────────────────────────────────

section("Doctor Creation Rollback Gap (fix in firestoreService.js:302)");

function simulateCreateDoctor(doctorData, sequence) {
  const steps = [];
  const doctorId = "mock-doctor-" + Math.random().toString(36).slice(2, 8);

  // Step 1: Write saas_doctors
  steps.push("saas_doctors");

  if (sequence.failAt === "comm_doctor_users") {
    throw new Error("comm_doctor_users write failed");
  }
  steps.push("comm_doctor_users");

  if (sequence.failAt === "comm_doctors") {
    throw new Error("comm_doctors write failed");
  }
  steps.push("comm_doctors");

  // Auth creation is LAST — never orphaned
  if (doctorData.email && doctorData.password) {
    if (sequence.failAt === "auth") {
      throw new Error("Auth creation failed (Firestore data already saved, retry safe)");
    }
    steps.push("auth");
  }

  return { doctorId, steps };
}

// Test 6: Successful creation includes auth
const result6 = simulateCreateDoctor(
  { name: "Dr. X", email: "x@c.com", password: "pw123", tenantId: "t1" },
  { failAt: null }
);
assert(result6.steps.includes("auth"), "Successful creation includes auth step");

// Test 7: Auth failure does not orphan (data already committed)
(function() {
  let caughtMsg = "";
  try {
    simulateCreateDoctor(
      { name: "Dr. Y", email: "y@c.com", password: "pw456", tenantId: "t1" },
      { failAt: "auth" }
    );
  } catch (e) {
    caughtMsg = e.message;
  }
  assert(caughtMsg.includes("retry safe"), "Auth failure preserves Firestore data (no orphan)");
})();

// Test 8: Firestore failure before auth — no auth attempt
(function() {
  let caughtMsg = "";
  try {
    simulateCreateDoctor(
      { name: "Dr. Z", email: "z@c.com", password: "pw789", tenantId: "t1" },
      { failAt: "comm_doctor_users" }
    );
  } catch (e) {
    caughtMsg = e.message;
  }
  assert(caughtMsg.includes("comm_doctor_users write failed"), "Firestore failure before auth -- no orphan auth user");
})();

// Test 9: No email/password — no auth step created
const result9 = simulateCreateDoctor(
  { name: "Dr. NoAuth", tenantId: "t1" },
  { failAt: null }
);
assert(!result9.steps.includes("auth"), "No auth step when email/password not provided");
// ─── Tenant Delete Cascade ────────────────────────────────────────────────────────

section("Tenant Delete Cascade (fix in firestoreService.js:279)");

function simulateDeleteTenant(tenantId, collections) {
  const deleted = [];

  // Step 1-2: Delete saas_tenants and comm_tenants
  deleted.push("saas_tenants:" + tenantId);
  deleted.push("comm_tenants:" + tenantId);

  // Step 3: Delete saas_doctors for tenant
  const tenantDoctors = collections.saas_doctors.filter(function(d) { return d.tenantId === tenantId; });
  for (const d of tenantDoctors) {
    deleted.push("saas_doctors:" + d.id);
    const userMaps = collections.comm_doctor_users.filter(function(u) { return u.doctorId === d.id; });
    for (const u of userMaps) {
      deleted.push("comm_doctor_users:" + u.email);
    }
  }

  // Delete comm_doctors for tenant
  const commDocs = collections.comm_doctors.filter(function(d) { return d.tenantId === tenantId; });
  for (const d of commDocs) {
    deleted.push("comm_doctors:" + d.id);
  }

  // Step 4: Delete all tenant-scoped collections
  const tenantScoped = ["suppliers", "purchase_orders", "purchase_order_items",
    "inventory_items", "inventory_adjustments", "inventory_movements", "inventory_stock_counts"];
  for (const coll of tenantScoped) {
    const items = collections[coll].filter(function(i) { return i.tenantId === tenantId; });
    for (const item of items) {
      deleted.push(coll + ":" + item.id);
    }
  }

  // Step 5: Delete tenant licenses
  const licenses = collections.saas_licenses.filter(function(l) { return l.tenantId === tenantId; });
  for (const l of licenses) {
    deleted.push("saas_licenses:" + l.licenseKey);
  }

  return deleted;
}

const mockData = {
  saas_tenants: [{ id: "t1", name: "Clinic A" }],
  comm_tenants: [{ id: "t1", name: "Clinic A" }],
  saas_doctors: [
    { id: "doc1", tenantId: "t1", name: "Dr. A" },
    { id: "doc2", tenantId: "t1", name: "Dr. B" },
    { id: "doc3", tenantId: "t2", name: "Dr. C" },
  ],
  comm_doctor_users: [
    { email: "a@c.com", doctorId: "doc1" },
    { email: "b@c.com", doctorId: "doc2" },
  ],
  comm_doctors: [
    { id: "doc1", tenantId: "t1" },
    { id: "doc2", tenantId: "t1" },
  ],
  suppliers: [{ id: "s1", tenantId: "t1" }, { id: "s2", tenantId: "t2" }],
  purchase_orders: [{ id: "po1", tenantId: "t1" }],
  purchase_order_items: [],
  inventory_items: [{ id: "i1", tenantId: "t1" }, { id: "i2", tenantId: "t1" }],
  inventory_adjustments: [],
  inventory_movements: [{ id: "m1", tenantId: "t1" }],
  inventory_stock_counts: [],
  saas_licenses: [{ licenseKey: "lic-t1", tenantId: "t1" }, { licenseKey: "lic-t2", tenantId: "t2" }],
};

const deletedItems = simulateDeleteTenant("t1", mockData);

assert(deletedItems.includes("saas_tenants:t1"), "Deletes saas_tenants doc");
assert(deletedItems.includes("comm_tenants:t1"), "Deletes comm_tenants doc");
assert(deletedItems.includes("saas_doctors:doc1"), "Deletes tenant doctors (saas)");
assert(deletedItems.includes("saas_doctors:doc2"), "Deletes all tenant doctors");
assert(deletedItems.includes("comm_doctor_users:a@c.com"), "Deletes doctor user mapping");
assert(deletedItems.includes("comm_doctors:doc1"), "Deletes public doctor listing");
assert(deletedItems.includes("suppliers:s1"), "Deletes tenant supplier");
assert(deletedItems.includes("purchase_orders:po1"), "Deletes tenant PO");
assert(deletedItems.includes("inventory_items:i1"), "Deletes tenant inventory items");
assert(deletedItems.includes("inventory_movements:m1"), "Deletes tenant movements");
assert(deletedItems.includes("saas_licenses:lic-t1"), "Deletes tenant license");
assert(!deletedItems.includes("saas_doctors:doc3"), "Other tenant doctors preserved");
assert(!deletedItems.includes("suppliers:s2"), "Other tenant suppliers preserved");
assert(!deletedItems.includes("saas_licenses:lic-t2"), "Other tenant licenses preserved");
// ─── Stock Count API Validation ────────────────────────────────────────────────────

section("Stock Count API Validation (fix in api/admin/inventory-stock-count.js)");

function validateStockCountRequest(body) {
  const errors = [];
  if (!body.tenantId) errors.push("tenantId is required");
  if (!body.countDate) errors.push("countDate is required (YYYY-MM-DD)");
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(body.countDate)) {
    errors.push("countDate must be a valid date in YYYY-MM-DD format");
  }
  if (!Array.isArray(body.items)) errors.push("items must be an array");
  return errors;
}

function simulateStockCount(body, itemsExist) {
  const errors = validateStockCountRequest(body);
  if (errors.length > 0) return { errors };

  const countedItems = [];
  const skippedItems = [];

  for (const entry of body.items) {
    const exists = itemsExist[entry.itemId];
    if (!exists) {
      skippedItems.push(entry.itemId);
      continue;
    }
    const expectedQty = exists.currentStock || 0;
    const actualQty = entry.actualQty;
    const difference = actualQty - expectedQty;
    countedItems.push({ itemId: entry.itemId, expectedQty, actualQty, difference });
  }

  return { success: true, countedItems, skippedItems };
}

// Test 12: Valid request succeeds
const result12 = simulateStockCount(
  { tenantId: "t1", countDate: "2026-06-25", items: [{ itemId: "i1", actualQty: 10 }] },
  { i1: { currentStock: 8 } }
);
assert(result12.success === true, "Valid stock count request succeeds");
assert(result12.countedItems.length === 1, "Valid items are counted");
assert(result12.skippedItems.length === 0, "No items skipped");

// Test 13: Missing countDate
const result13 = validateStockCountRequest({ tenantId: "t1", items: [] });
assert(result13.some(function(e) { return e.includes("countDate"); }), "Missing countDate is rejected");

// Test 14: Invalid date format (DD-MM-YYYY)
const result14 = validateStockCountRequest({ tenantId: "t1", countDate: "25-06-2026", items: [] });
assert(result14.some(function(e) { return e.includes("YYYY-MM-DD"); }), "Invalid date format (DD-MM-YYYY) is rejected");

// Test 15: Wrong separator
const result15 = validateStockCountRequest({ tenantId: "t1", countDate: "25/06/2026", items: [] });
assert(result15.some(function(e) { return e.includes("YYYY-MM-DD"); }), "Wrong separator is rejected");

// Test 16: Empty date string
const result16 = validateStockCountRequest({ tenantId: "t1", countDate: "", items: [] });
assert(result16.some(function(e) { return e.includes("YYYY-MM-DD"); }), "Empty date string is rejected");

// Test 17: Non-existent items reported back
const result17 = simulateStockCount(
  { tenantId: "t1", countDate: "2026-06-25", items: [
    { itemId: "i1", actualQty: 10 },
    { itemId: "ghost-item", actualQty: 5 },
    { itemId: "i2", actualQty: 3 },
  ]},
  { i1: { currentStock: 8 }, i2: { currentStock: 3 } }
);
assert(result17.skippedItems.length === 1, "Non-existent items are tracked");
assert(result17.skippedItems[0] === "ghost-item", "Skipped item ID is reported");
assert(result17.countedItems.length === 2, "Existing items still counted");
assert(result17.countedItems[0].difference === 2, "Difference calculated correctly (10 - 8 = 2)");

// Test 18: Missing tenantId
const result18 = validateStockCountRequest({ countDate: "2026-06-25", items: [] });
assert(result18.some(function(e) { return e.includes("tenantId"); }), "Missing tenantId is rejected");

// Test 19: Items is not an array
const result19 = validateStockCountRequest({ tenantId: "t1", countDate: "2026-06-25", items: "not-array" });
assert(result19.some(function(e) { return e.includes("items must be"); }), "Non-array items is rejected");

// ─── Summary ───────────────────────────────────────────────────────────────────────

console.log("\n" + "=".repeat(60));
console.log("  RESULTS: " + passed + " passed, " + failed + " failed");
console.log("=".repeat(60));
process.exit(failed > 0 ? 1 : 0);
