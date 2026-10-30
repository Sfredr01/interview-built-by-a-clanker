import { test, expect } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

// BUG-C18: POST /favorites must validate its body instead of throwing/accepting junk.
async function authHeaders(request: any) {
  const id = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const res = await request.post(`${apiURL}/auth/register`, {
    data: { username: `fav${id}`.slice(0, 30), email: `fav${id}@example.com`, password: "secret1" },
  });
  expect(res.status()).toBeLessThan(300);
  const { token } = await res.json();
  return { Authorization: `Bearer ${token}` };
}

for (const [label, data] of [
  ["empty object", {}],
  ["numeric personaId", { personaId: 1 }],
  ["object personaId", { personaId: {} }],
  ["empty string personaId", { personaId: "" }],
] as const) {
  test(`${label} is rejected with 400`, async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${apiURL}/favorites`, { headers, data });
    expect(res.status()).toBe(400);
  });
}

test("JSON null body is rejected with 400, not 500", async ({ request }) => {
  const headers = await authHeaders(request);
  const res = await request.post(`${apiURL}/favorites`, {
    headers: { ...headers, "Content-Type": "application/json" },
    data: "null",
  });
  expect(res.status()).toBeLessThan(500);
  expect(res.status()).toBe(400);
});

test("unknown persona is 404; valid persona is 200 and idempotent", async ({ request }) => {
  const headers = await authHeaders(request);
  const missing = await request.post(`${apiURL}/favorites`, { headers, data: { personaId: "p-999" } });
  expect(missing.status()).toBe(404);

  for (let i = 0; i < 2; i++) {
    const ok = await request.post(`${apiURL}/favorites`, { headers, data: { personaId: "p-001" } });
    expect(ok.status()).toBe(200);
  }
  const list = await request.get(`${apiURL}/favorites`, { headers });
  const { favorites } = await list.json();
  expect(favorites.map((p: { id: string }) => p.id)).toEqual(["p-001"]);
});
