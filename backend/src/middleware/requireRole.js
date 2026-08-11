/**
 * Must run after authenticate(). Responds 403 unless req.user.role is one
 * of allowedRoles.
 */
function requireRole(allowedRoles) {
  return function (req, res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

module.exports = requireRole;
