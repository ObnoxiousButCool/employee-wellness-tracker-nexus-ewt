function serializeRole(row) {
  return { id: row.id, name: row.name };
}

/** GET /api/admin/roles — read-only lookup of the canonical roles table. */
async function listRoles(req, res) {
  const prisma = req.app.locals.prisma;
  const rows = await prisma.role.findMany({ orderBy: { id: "asc" } });
  return res.status(200).json({ data: rows.map(serializeRole) });
}

module.exports = { listRoles, serializeRole };
