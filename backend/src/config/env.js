const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });

/**
 * Centralized, validated access to process.env for the backend.
 */
const env = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "",
};

module.exports = env;
