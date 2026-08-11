import http from "node:http";
import jwt from "jsonwebtoken";

/**
 * A plain `node:http` server implementing the documented `/api/admin/*`
 * contract byte-for-byte (same status codes, same JSON shapes as the real
 * backend): auth via `ewt_token`, paginated user listing with role/department
 * names resolved, email/department-name uniqueness (409), and department
 * deactivation that never cascades to `users`. Deliberately does NOT import
 * anything from `backend/` — the frontend's own layer/branch does not always
 * carry the backend's source tree (see PROJECT_CONTEXT.md), so a live
 * integration test that `require()`s backend internals is not reliably
 * runnable in this layer's own CI. This mirrors the pattern already used by
 * `__tests__/liveIntegration.test.js` for the S1 auth endpoints.
 */

const JWT_SECRET = "admin-live-integration-test-secret";

export function adminToken() {
  return jwt.sign({ userId: 1, role: "ADMIN", departmentId: 1 }, JWT_SECRET, { expiresIn: "8h" });
}

function seedState() {
  return {
    roles: [
      { id: 1, name: "ADMIN" },
      { id: 2, name: "MANAGER" },
      { id: 3, name: "EMPLOYEE" },
    ],
    departments: [{ id: 1, name: "Engineering", isActive: true }],
    users: [
      {
        id: 1,
        name: "Seed Admin",
        email: "seed-admin@ewt.test",
        roleId: 1,
        departmentId: 1,
        isActive: true,
      },
    ],
    nextUserId: 2,
    nextDepartmentId: 2,
  };
}

function authenticated(req) {
  const cookie = req.headers.cookie || "";
  const token = /ewt_token=([^;]+)/.exec(cookie)?.[1];
  if (!token) return false;
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

function departmentView(department, state) {
  const activeUserCount = state.users.filter(
    (u) => u.departmentId === department.id && u.isActive
  ).length;
  return { ...department, activeUserCount };
}

function userView(user, state) {
  const role = state.roles.find((r) => r.id === user.roleId);
  const department = state.departments.find((d) => d.id === user.departmentId);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    role: role?.name || null,
    departmentId: user.departmentId,
    department: department?.name || null,
    isActive: user.isActive,
  };
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function handleUsers(req, res, url, raw, state) {
  if (req.method === "GET") {
    const data = state.users.map((u) => userView(u, state));
    return send(res, 200, { data, pagination: { page: 1, pageSize: 20, total: data.length, totalPages: 1 } });
  }
  if (req.method === "POST") {
    const body = JSON.parse(raw);
    if (state.users.some((u) => u.email === body.email)) {
      return send(res, 409, { error: "Email is already in use" });
    }
    const user = {
      id: state.nextUserId++,
      name: body.name,
      email: body.email,
      roleId: body.roleId,
      departmentId: body.departmentId ?? null,
      isActive: true,
    };
    state.users.push(user);
    return send(res, 201, userView(user, state));
  }
  return send(res, 404, {});
}

function handleUserById(req, res, id, raw, state) {
  const user = state.users.find((u) => u.id === id);
  if (!user) return send(res, 404, { error: "User not found" });
  if (req.method === "PUT") {
    Object.assign(user, JSON.parse(raw));
    return send(res, 200, userView(user, state));
  }
  return send(res, 404, {});
}

function handleUserStatus(req, res, id, raw, state) {
  const user = state.users.find((u) => u.id === id);
  if (!user) return send(res, 404, { error: "User not found" });
  user.isActive = JSON.parse(raw).isActive;
  return send(res, 200, userView(user, state));
}

function handleDepartments(req, res, raw, state) {
  if (req.method === "GET") {
    return send(res, 200, { data: state.departments.map((d) => departmentView(d, state)) });
  }
  if (req.method === "POST") {
    const body = JSON.parse(raw);
    if (state.departments.some((d) => d.name === body.name)) {
      return send(res, 409, { error: "Department name is already in use" });
    }
    const department = { id: state.nextDepartmentId++, name: body.name, isActive: true };
    state.departments.push(department);
    return send(res, 201, departmentView(department, state));
  }
  return send(res, 404, {});
}

function handleDepartmentById(req, res, id, raw, state) {
  const department = state.departments.find((d) => d.id === id);
  if (!department) return send(res, 404, { error: "Department not found" });
  if (req.method === "PUT") {
    Object.assign(department, JSON.parse(raw));
    return send(res, 200, departmentView(department, state));
  }
  return send(res, 404, {});
}

export function startFakeAdminBackend() {
  const state = seedState();

  const server = http.createServer((req, res) => {
    if (!authenticated(req)) return send(res, 401, { error: "Unauthorized" });

    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const url = new URL(req.url, "http://localhost");
      const userByIdMatch = /^\/api\/admin\/users\/(\d+)$/.exec(url.pathname);
      const userStatusMatch = /^\/api\/admin\/users\/(\d+)\/status$/.exec(url.pathname);
      const departmentByIdMatch = /^\/api\/admin\/departments\/(\d+)$/.exec(url.pathname);

      if (url.pathname === "/api/admin/users") return handleUsers(req, res, url, raw, state);
      if (userStatusMatch) return handleUserStatus(req, res, Number(userStatusMatch[1]), raw, state);
      if (userByIdMatch) return handleUserById(req, res, Number(userByIdMatch[1]), raw, state);
      if (url.pathname === "/api/admin/departments") return handleDepartments(req, res, raw, state);
      if (departmentByIdMatch) return handleDepartmentById(req, res, Number(departmentByIdMatch[1]), raw, state);
      return send(res, 404, {});
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}
