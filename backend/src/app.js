const express = require("express");
const cookieParser = require("cookie-parser");
const adminRoutes = require("./routes/adminRoutes");
const wellnessRoutes = require("./routes/wellnessRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const departmentWellnessRoutes = require("./routes/departmentWellnessRoutes");
const defaultPrisma = require("./config/prisma");

/**
 * Builds the Express app. Accepts an injectable Prisma client so tests can
 * run the real HTTP/middleware/validation stack against an in-memory fake
 * instead of a live Postgres database.
 */
function createApp({ prisma = defaultPrisma } = {}) {
  const app = express();
  app.locals.prisma = prisma;

  app.use(express.json());
  app.use(cookieParser());

  app.use("/api/admin", adminRoutes);
  app.use("/api/wellness", wellnessRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/departments", departmentWellnessRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

module.exports = createApp;
