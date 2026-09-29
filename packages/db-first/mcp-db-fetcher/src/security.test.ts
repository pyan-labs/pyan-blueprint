import { test } from "node:test";
import assert from "node:assert/strict";
import { assertSelectOnly, findWritePermissions, isReadonlyEntry, quoteIdentifier } from "./security.js";

test("readonly defaults to true unless explicitly false", () => {
  const base = { server: "s", database: "d" };
  assert.equal(isReadonlyEntry(base), true);
  assert.equal(isReadonlyEntry({ ...base, readonly: true }), true);
  assert.equal(isReadonlyEntry({ ...base, readonly: false }), false);
});

test("reader permissions pass the readonly account check", () => {
  assert.deepEqual(
    findWritePermissions([
      "CONNECT", "SELECT", "SHOWPLAN", "VIEW DEFINITION",
      "VIEW ANY COLUMN ENCRYPTION KEY DEFINITION", "VIEW DATABASE STATE",
    ]),
    []
  );
});

test("write or control permissions fail the readonly account check", () => {
  assert.deepEqual(
    findWritePermissions(["CONNECT", "SELECT", "INSERT", "CONTROL", "ALTER ANY SCHEMA", "EXECUTE"]),
    ["INSERT", "CONTROL", "ALTER ANY SCHEMA", "EXECUTE"]
  );
});

test("select-only check accepts plain SELECT and CTE", () => {
  assertSelectOnly("SELECT UpdatedAt, DeletedBy FROM dbo.Orders");
  assertSelectOnly("WITH c AS (SELECT 1 AS n) SELECT n FROM c");
});

test("select-only check rejects statements that write", () => {
  for (const q of [
    "UPDATE dbo.Orders SET x = 1",
    "SELECT * INTO dbo.Copy FROM dbo.Orders",
    "SELECT 1; DROP TABLE dbo.Orders",
    "WITH c AS (SELECT 1 AS n) MERGE dbo.T USING c ON 1=0 WHEN NOT MATCHED THEN INSERT VALUES (1);",
    "SELECT 1; GRANT CONTROL TO public",
    "SELECT * FROM OPENROWSET('SQLNCLI', 'x', 'SELECT 1')",
    "SELECT 1; COMMIT",
  ]) {
    assert.throws(() => assertSelectOnly(q), Error, q);
  }
});

test("quoteIdentifier escapes closing brackets", () => {
  assert.equal(quoteIdentifier("Orders"), "[Orders]");
  assert.equal(quoteIdentifier("x]; DROP TABLE y;--"), "[x]]; DROP TABLE y;--]");
});
