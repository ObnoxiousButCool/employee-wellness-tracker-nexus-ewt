const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MOOD_VALUES = ["VERY_LOW", "LOW", "NEUTRAL", "GOOD", "GREAT"];
const ENERGY_LEVEL_VALUES = ["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

function isNumberInRange(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Validates the body of POST /api/admin/users.
 * Returns a list of human-readable field errors; empty list means valid.
 */
function validateCreateUser(body) {
  const errors = [];
  if (!isNonEmptyString(body.name)) errors.push("name is required");
  if (!isNonEmptyString(body.email) || !EMAIL_RE.test(body.email.trim())) {
    errors.push("a valid email is required");
  }
  if (!isNonEmptyString(body.password) || body.password.length < 8) {
    errors.push("password must be at least 8 characters");
  }
  if (!isPositiveInt(body.roleId)) errors.push("roleId is required");
  if (
    body.departmentId !== undefined &&
    body.departmentId !== null &&
    !isPositiveInt(body.departmentId)
  ) {
    errors.push("departmentId must be a positive integer or null");
  }
  return errors;
}

/**
 * Validates the body of PUT /api/admin/users/:id. All fields optional,
 * but at least one must be present, and provided fields must be well-formed.
 */
function validateUpdateUser(body) {
  const errors = [];
  const fields = ["name", "email", "roleId", "departmentId"];
  if (!fields.some((f) => body[f] !== undefined)) {
    errors.push("at least one field to update is required");
  }
  if (body.name !== undefined && !isNonEmptyString(body.name)) {
    errors.push("name must be a non-empty string");
  }
  if (
    body.email !== undefined &&
    (!isNonEmptyString(body.email) || !EMAIL_RE.test(body.email.trim()))
  ) {
    errors.push("email must be a valid email");
  }
  if (body.roleId !== undefined && !isPositiveInt(body.roleId)) {
    errors.push("roleId must be a positive integer");
  }
  if (
    body.departmentId !== undefined &&
    body.departmentId !== null &&
    !isPositiveInt(body.departmentId)
  ) {
    errors.push("departmentId must be a positive integer or null");
  }
  return errors;
}

function validateStatusUpdate(body) {
  const errors = [];
  if (typeof body.isActive !== "boolean") {
    errors.push("isActive must be a boolean");
  }
  return errors;
}

function validateCreateDepartment(body) {
  const errors = [];
  if (!isNonEmptyString(body.name)) errors.push("name is required");
  if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
    errors.push("isActive must be a boolean");
  }
  return errors;
}

function validateUpdateDepartment(body) {
  const errors = [];
  if (body.name === undefined && body.isActive === undefined) {
    errors.push("at least one field to update is required");
  }
  if (body.name !== undefined && !isNonEmptyString(body.name)) {
    errors.push("name must be a non-empty string");
  }
  if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
    errors.push("isActive must be a boolean");
  }
  return errors;
}

/**
 * Validates the body of POST /api/wellness/entries.
 * Returns a field-name -> message error object (empty object means valid),
 * matching the 422 field-level error contract the story requires.
 */
function validateWellnessEntry(body) {
  const errors = {};

  if (!Number.isInteger(body.stressLevel) || body.stressLevel < 1 || body.stressLevel > 10) {
    errors.stressLevel = "stressLevel must be an integer between 1 and 10";
  }
  if (!isNumberInRange(body.workHours, 0, 24)) {
    errors.workHours = "workHours must be a number between 0 and 24";
  }
  if (!isNumberInRange(body.sleepHours, 0, 24)) {
    errors.sleepHours = "sleepHours must be a number between 0 and 24";
  }
  if (typeof body.mood !== "string" || !MOOD_VALUES.includes(body.mood)) {
    errors.mood = `mood must be one of: ${MOOD_VALUES.join(", ")}`;
  }
  if (typeof body.energyLevel !== "string" || !ENERGY_LEVEL_VALUES.includes(body.energyLevel)) {
    errors.energyLevel = `energyLevel must be one of: ${ENERGY_LEVEL_VALUES.join(", ")}`;
  }
  if (
    body.entryDate !== undefined &&
    (typeof body.entryDate !== "string" || !DATE_RE.test(body.entryDate))
  ) {
    errors.entryDate = "entryDate must be a valid date in YYYY-MM-DD format";
  }

  if (
    errors.workHours === undefined &&
    errors.sleepHours === undefined &&
    body.workHours + body.sleepHours > 24
  ) {
    errors.workHours = "workHours plus sleepHours must not exceed 24";
  }

  return errors;
}

function validateDateRangeQuery(query) {
  const errors = {};
  if (query.from !== undefined && (typeof query.from !== "string" || !DATE_RE.test(query.from))) {
    errors.from = "from must be a valid date in YYYY-MM-DD format";
  }
  if (query.to !== undefined && (typeof query.to !== "string" || !DATE_RE.test(query.to))) {
    errors.to = "to must be a valid date in YYYY-MM-DD format";
  }
  return errors;
}

module.exports = {
  validateCreateUser,
  validateUpdateUser,
  validateStatusUpdate,
  validateCreateDepartment,
  validateUpdateDepartment,
  validateWellnessEntry,
  validateDateRangeQuery,
  MOOD_VALUES,
  ENERGY_LEVEL_VALUES,
  DATE_RE,
};
