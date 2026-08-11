const jwt = require("jsonwebtoken");
const env = require("../config/env");

/**
 * Verifies the ewt_token JWT (httpOnly cookie, or Authorization: Bearer
 * fallback) and attaches { userId, role, departmentId } to req.user.
 * Responds 401 if the token is missing, malformed, or expired.
 */
function authenticate(req, res, next) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice("Bearer ".length)
    : null;
  const token = req.cookies?.ewt_token || bearer;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = {
      userId: payload.userId,
      role: payload.role,
      departmentId: payload.departmentId,
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

module.exports = authenticate;
