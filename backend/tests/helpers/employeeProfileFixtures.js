const { buildTestApp } = require("./testApp");

const DEPARTMENTS = [
  { id: 1, name: "Engineering", isActive: true },
  { id: 2, name: "Sales", isActive: true },
];

const DEFAULT_PROFILE_RANGE_DAYS = 30;

const now = new Date();
function makeUser(overrides) {
  return { passwordHash: "x", isActive: true, createdAt: now, updatedAt: now, ...overrides };
}

const USERS = [
  makeUser({ id: 1, name: "Mia Manager", email: "mia@x.com", roleId: 2, departmentId: 1 }),
  makeUser({ id: 2, name: "Bob Engineer", email: "bob@x.com", roleId: 3, departmentId: 1 }),
  makeUser({ id: 3, name: "Carol Sales", email: "carol@x.com", roleId: 3, departmentId: 2 }),
];

function recentDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function entry(overrides) {
  return { workHours: 8, createdAt: now, updatedAt: now, ...overrides };
}

const ENTRIES = [
  entry({
    id: 1,
    userId: 2,
    entryDate: recentDate(1),
    stressLevel: 4,
    sleepHours: 6,
    mood: "GOOD",
    energyLevel: "HIGH",
  }),
  entry({
    id: 2,
    userId: 2,
    entryDate: recentDate(2),
    stressLevel: 6,
    sleepHours: 8,
    mood: "NEUTRAL",
    energyLevel: "MEDIUM",
  }),
];

function buildApp() {
  return buildTestApp({ departments: DEPARTMENTS, users: USERS, wellnessEntries: ENTRIES });
}

module.exports = {
  DEPARTMENTS,
  DEFAULT_PROFILE_RANGE_DAYS,
  USERS,
  ENTRIES,
  makeUser,
  recentDate,
  entry,
  buildApp,
};
