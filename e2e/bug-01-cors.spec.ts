import { test, expect } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;
const webOrigin = `http://localhost:${process.env.E2E_WEB_PORT ?? 4173}`;

// BUG-C01: CORS preflight for DELETE must be allowed or browsers block the request.
for (const path of ["/cart/x", "/favorites/x"]) {
  test(`preflight for DELETE ${path} allows DELETE`, async ({ request }) => {
    const res = await request.fetch(`${apiURL}${path}`, {
      method: "OPTIONS",
      headers: {
        Origin: webOrigin,
        "Access-Control-Request-Method": "DELETE",
      },
    });
    expect(res.status()).toBe(204);
    const allowed = res.headers()["access-control-allow-methods"] ?? "";
    for (const method of ["GET", "POST", "PUT", "DELETE"]) {
      expect(allowed).toContain(method);
    }
  });
}
