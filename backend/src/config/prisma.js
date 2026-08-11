const { PrismaClient } = require("@prisma/client");

/**
 * Singleton PrismaClient for the running process. Tests build their own
 * app instance with an in-memory fake instead of importing this module.
 */
const prisma = new PrismaClient();

module.exports = prisma;
