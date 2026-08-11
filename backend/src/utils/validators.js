const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
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

module.exports = {
  validateCreateUser,
  validateUpdateUser,
  validateStatusUpdate,
  validateCreateDepartment,
  validateUpdateDepartment,
};
