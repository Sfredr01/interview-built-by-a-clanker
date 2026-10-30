import { test, expect } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

test.describe("BUG-C02 auth enforcement", () => {
  test("rejects missing or invalid tokens, accepts a valid one", async ({ request }) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const reg = await request.post(`${apiURL}/auth/register`, {
      data: {
        username: `user${unique}`,
        email: `user-${unique}@example.com`,
        password: "password123",
      },
    });
    expect(reg.status()).toBe(201);
    const { token } = await reg.json();

    const noToken = await request.get(`${apiURL}/cart`);
    expect(noToken.status()).toBe(401);
    expect(await noToken.json()).toEqual({ error: "Unauthorized" });

    const garbage = await request.get(`${apiURL}/cart`, {
      headers: { Authorization: "Bearer garbage" },
    });
    expect(garbage.status()).toBe(401);

    const ok = await request.get(`${apiURL}/cart`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toEqual({ items: [], total: 0 });

    expect((await request.post(`${apiURL}/checkout`, { data: {} })).status()).toBe(401);
    expect((await request.get(`${apiURL}/favorites`)).status()).toBe(401);
  });
});
