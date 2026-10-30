import { test, expect } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

test.describe("BUG-C11 login response includes username", () => {
  test("login user matches register user and contract", async ({ request }) => {
    const unique = Math.random().toString(36).slice(2, 8);
    const username = `loginuser${unique}`;
    const email = `login-${Date.now()}-${unique}@example.com`;
    const password = "secret1";

    const reg = await request.post(`${apiURL}/auth/register`, {
      data: { username, email, password },
    });
    expect(reg.status()).toBe(201);
    const regBody = await reg.json();

    const login = await request.post(`${apiURL}/auth/login`, {
      data: { email, password },
    });
    expect(login.status()).toBe(200);
    const loginBody = await login.json();

    expect(loginBody.user).toEqual({ id: expect.any(String), username, email });
    expect(loginBody.user).toEqual(regBody.user);
  });

  test("wrong password -> 401", async ({ request }) => {
    const unique = Math.random().toString(36).slice(2, 8);
    const email = `login-bad-${Date.now()}-${unique}@example.com`;
    const reg = await request.post(`${apiURL}/auth/register`, {
      data: { username: `loginuser${unique}`, email, password: "secret1" },
    });
    expect(reg.status()).toBe(201);

    const login = await request.post(`${apiURL}/auth/login`, {
      data: { email, password: "wrong-password" },
    });
    expect(login.status()).toBe(401);
  });
});
