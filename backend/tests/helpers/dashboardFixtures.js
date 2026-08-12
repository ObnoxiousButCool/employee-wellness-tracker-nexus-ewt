const { buildTestApp } = require("./testApp");

const DEPARTMENTS = [
  { id: 1, name: "Engineering", isActive: true },
  { id: 2, name: "Sales", isActive: true },
];

const now = new Date();
function makeUser(overrides) {
  return { passwordHash: "x", isActive: true, createdAt: now, updatedAt: now, ...overrides };
}

// roleId 1 = ADMIN, 2 = MANAGER, 3 = EMPLOYEE (see helpers/testApp.js SEED_ROLES).
const USERS = [
  makeUser({ id: 1, name: "Mia Manager", email: "mia@x.com", roleId: 2, departmentId: 1 }),
  makeUser({ id: 2, name: "Bob Engineer", email: "bob@x.com", roleId: 3, departmentId: 1 }),
  makeUser({ id: 3, name: "Carol Sales", email: "carol@x.com", roleId: 3, departmentId: 2 }),
  makeUser({ id: 4, name: "Dave Engineer", email: "dave@x.com", roleId: 3, departmentId: 1 }),
];

/** entryDate is a @db.Date column stored at local midnight; zero the
 *  time-of-day so range/equality comparisons against today/weekStart
 *  (also zeroed, see dashboardController.js) behave the same way they do
 *  against real Prisma. */
function dayOffset(daysAgo) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function entry(overrides) {
  return { workHours: 8, createdAt: now, updatedAt: now, ...overrides };
}

const ENTRIES = [
  // Bob: two entries within the trailing 7 days -> avgStress (9+7)/2 = 8, most recent = today.
  entry({ id: 1, userId: 2, entryDate: dayOffset(0), stressLevel: 9, sleepHours: 5, mood: "LOW", energyLevel: "LOW" }),
  entry({ id: 2, userId: 2, entryDate: dayOffset(2), stressLevel: 7, sleepHours: 6, mood: "NEUTRAL", energyLevel: "MEDIUM" }),
  // Bob: an older entry outside the trailing 7-day window -- must not affect the average above.
  entry({ id: 3, userId: 2, entryDate: dayOffset(10), stressLevel: 1, sleepHours: 8, mood: "GREAT", energyLevel: "VERY_HIGH" }),
  // Dave: single entry, avgStress 9, one day older than Bob's most recent.
  entry({ id: 4, userId: 4, entryDate: dayOffset(1), stressLevel: 9, sleepHours: 8, mood: "GOOD", energyLevel: "HIGH" }),
  // Carol (Sales): low stress, today.
  entry({ id: 5, userId: 3, entryDate: dayOffset(0), stressLevel: 3, sleepHours: 8, mood: "GREAT", energyLevel: "HIGH" }),
];

function buildApp(overrides = {}) {
  return buildTestApp({ departments: DEPARTMENTS, users: USERS, wellnessEntries: ENTRIES, ...overrides });
}

module.exports = { DEPARTMENTS, USERS, ENTRIES, makeUser, dayOffset, entry, buildApp };
