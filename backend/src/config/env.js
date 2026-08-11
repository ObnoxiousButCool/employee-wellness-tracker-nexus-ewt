const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });

// A missing JWT_SECRET must never silently fall back to "" — jwt.verify(token, "")
// would accept any token forged with an empty signing secret, letting an
// attacker mint valid admin sessions. Fail fast at startup instead.
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required and must not be empty");
}

/**
 * Centralized, validated access to process.env for the backend.
 */
const env = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET,
};

module.exports = env;
