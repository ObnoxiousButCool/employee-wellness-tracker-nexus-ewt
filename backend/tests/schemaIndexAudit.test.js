const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// S7 (performance/security audit story): asserts the two indexed-column
// requirements the technical plan calls out -- wellness_entries(user_id,
// entry_date) and users(department_id, is_active) -- are actually present
// in both the Prisma schema (source of truth for future migrations) and the
// already-applied migration SQL (source of truth for what a real database
// has). There is no live Postgres in this environment (see every prior
// story's backend Change Log entry), so unlike an endpoint or component,
// there is no running behavior to execute here -- the schema/migration
// files themselves are the declarative artifact under test.

const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
const migrationsDir = path.join(__dirname, "..", "prisma", "migrations");

function readAllMigrationSql() {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => fs.readFileSync(path.join(migrationsDir, entry.name, "migration.sql"), "utf8"))
    .join("\n");
}

test("schema.prisma declares a composite index/constraint on wellness_entries(user_id, entry_date)", () => {
  const schema = fs.readFileSync(schemaPath, "utf8");
  const wellnessEntryModel = schema.slice(schema.indexOf("model WellnessEntry"), schema.indexOf("model WellnessEntry") + schema.slice(schema.indexOf("model WellnessEntry")).indexOf("\n}"));
  assert.match(wellnessEntryModel, /@@unique\(\[userId,\s*entryDate\]\)/);
});

test("schema.prisma declares a composite index on users(department_id, is_active)", () => {
  const schema = fs.readFileSync(schemaPath, "utf8");
  const userModel = schema.slice(schema.indexOf("model User "), schema.indexOf("model User ") + schema.slice(schema.indexOf("model User ")).indexOf("\n}"));
  assert.match(userModel, /@@index\(\[departmentId,\s*isActive\]\)/);
});

test("applied migrations create a real index on wellness_entries(user_id, entry_date)", () => {
  const sql = readAllMigrationSql();
  assert.match(sql, /CREATE UNIQUE INDEX "wellness_entries_user_id_entry_date_key" ON "wellness_entries"\("user_id", "entry_date"\)/);
});

test("applied migrations create a real index on users(department_id, is_active)", () => {
  const sql = readAllMigrationSql();
  assert.match(sql, /CREATE INDEX "users_department_id_is_active_idx" ON "users"\("department_id", "is_active"\)/);
});
