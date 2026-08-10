import "@testing-library/jest-dom/vitest";

// Matches the value the backend signs with in its own test suite, so tests
// that mint a JWT here can be verified by lib/session.js the same way the
// real ewt_token cookie would be.
process.env.JWT_SECRET = "test-secret";
