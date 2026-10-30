import { test, expect } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// BUG-D02: whitespace must be trimmed from username, email and checkout name; password untouched.
test("whitespace-only username is rejected", async ({ request }) => {
  const res = await request.post(`${apiURL}/auth/register`, {
    data: { username: "   ", email: `ws-${uniq()}@example.com`, password: "secret1" },
  });
  expect(res.status()).toBe(400);
});

test("padded username is stored trimmed and padded email can log in", async ({ request }) => {
  const s = uniq();
  const email = `pad-${s}@example.com`;
  const res = await request.post(`${apiURL}/auth/register`, {
    data: { username: `  pad${s}  `.slice(0, 30), email: `  ${email}  `, password: "secret1" },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.user.username).toBe(`pad${s}`);
  expect(body.user.email).toBe(email);

  const login = await request.post(`${apiURL}/auth/login`, {
    data: { email: `  ${email}  `, password: "secret1" },
  });
  expect(login.status()).toBe(200);
});

test("password is not trimmed", async ({ request }) => {
  const s = uniq();
  const email = `pw-${s}@example.com`;
  const reg = await request.post(`${apiURL}/auth/register`, {
    data: { username: `pw${s}`, email, password: "   abc   " },
  });
  expect(reg.status()).toBe(201);
  const ok = await request.post(`${apiURL}/auth/login`, { data: { email, password: "   abc   " } });
  expect(ok.status()).toBe(200);
  const bad = await request.post(`${apiURL}/auth/login`, { data: { email, password: "abc" } });
  expect(bad.status()).toBe(401);
});

async function userWithCart(request: import("@playwright/test").APIRequestContext) {
  const s = uniq();
  const reg = await request.post(`${apiURL}/auth/register`, {
    data: { username: `co${s}`, email: `co-${s}@example.com`, password: "secret1" },
  });
  const headers = { Authorization: `Bearer ${(await reg.json()).token}` };
  const add = await request.post(`${apiURL}/cart`, {
    headers,
    data: { personaId: "p-001", quantity: 1 },
  });
  expect(add.ok()).toBeTruthy();
  return headers;
}

test("whitespace-only checkout name is rejected and cart kept", async ({ request }) => {
  const headers = await userWithCart(request);
  const res = await request.post(`${apiURL}/checkout`, {
    headers,
    data: { name: "   ", email: "a@x.com" },
  });
  expect(res.status()).toBe(400);
  const cart = await (await request.get(`${apiURL}/cart`, { headers })).json();
  expect(cart.items).toHaveLength(1);
});

test("checkout name is stored trimmed", async ({ request }) => {
  const headers = await userWithCart(request);
  const res = await request.post(`${apiURL}/checkout`, {
    headers,
    data: { name: " Ada ", email: " a@x.com " },
  });
  expect(res.status()).toBe(201);
  const order = await res.json();
  expect(order.customerName).toBe("Ada");
  expect(order.customerEmail).toBe("a@x.com");
});
