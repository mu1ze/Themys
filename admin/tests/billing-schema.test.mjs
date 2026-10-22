import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import test from "node:test";

test("billing migration preserves case and financial records without duplicating open refunds", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys = ON");
    for (const name of ["0001_initial.sql", "0003_safari_ios_client.sql", "0004_jev_diagnostics.sql", "0005_billing_operations.sql"]) {
      db.exec(readFileSync(join(import.meta.dirname, "../../d1/migrations", name), "utf8"));
    }
    db.prepare("INSERT INTO users (id, clerk_id, email) VALUES (?, ?, ?)").run("user-1", "clerk-1", "buyer@example.test");
    db.prepare("INSERT INTO invoices (id, user_id, amount, status) VALUES (?, ?, ?, ?)").run("invoice-1", "user-1", 2.49, "paid");
    db.prepare(`INSERT INTO purchase_acceptances
      (stripe_session_id, user_id, clerk_id, price_id, product_kind, terms_version,
       privacy_version, refund_version, acknowledgement_version, commercial_terms, livemode, accepted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run("cs_test", "user-1", "clerk-1", "price_test", "subscription",
        "2026-09-22", "2026-09-22", "2026-09-22", "checkout-2026-09-22",
        "Personal monthly subscription", 0, "2026-09-22T00:00:00Z");
    const insertCase = db.prepare(`INSERT INTO billing_cases
      (id, user_id, kind, priority, invoice_id, reason, response_due_at)
      VALUES (?, 'user-1', 'refund_request', 'P2', 'invoice-1', 'Unused renewal', '2026-09-24T00:00:00Z')`);
    insertCase.run("case-1");
    assert.throws(() => insertCase.run("case-2"), /UNIQUE/);
    db.prepare("UPDATE billing_cases SET status = 'denied' WHERE id = 'case-1'").run();
    insertCase.run("case-2");
    db.prepare(`INSERT INTO payment_refunds (stripe_refund_id, case_id, user_id, amount_minor,
      currency, status, livemode, created_at) VALUES ('re_test', 'case-2', 'user-1', 249,
      'usd', 'succeeded', 0, '2026-09-22T00:00:00Z')`).run();
    assert.throws(() => db.prepare(`INSERT INTO payment_refunds (stripe_refund_id, amount_minor,
      currency, status, livemode, created_at) VALUES ('re_test', 249, 'usd', 'succeeded', 0,
      '2026-09-22T00:00:00Z')`).run(), /UNIQUE/);

    db.prepare("DELETE FROM users WHERE id = 'user-1'").run();
    assert.equal(db.prepare("SELECT user_id FROM billing_cases WHERE id = 'case-2'").get().user_id, null);
    assert.equal(db.prepare("SELECT user_id FROM payment_refunds WHERE stripe_refund_id = 're_test'").get().user_id, null);
    assert.equal(db.prepare("SELECT user_id FROM purchase_acceptances WHERE stripe_session_id = 'cs_test'").get().user_id, null);
  } finally {
    db.close();
  }
});
