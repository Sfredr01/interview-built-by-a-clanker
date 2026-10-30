import { test, expect, type APIRequestContext } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;
const MAX = Number.MAX_SAFE_INTEGER;

async function registerUser(request: APIRequestContext, label: string) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const username = `${label}-${suffix}`.slice(0, 30);
  const res = await request.post(`${apiURL}/auth/register`, {
    data: { username, email: `${username}@example.com`, password: "secret1" },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { Authorization: `Bearer ${body.token}` };
}

// BUG-D01: unbounded quantity overflows to Infinity (serialised as null).
test("add rejects quantity 1e308", async ({ request }) => {
  const h = await registerUser(request, "d01-a");
  const res = await request.post(`${apiURL}/cart`, {
    headers: h,
    data: { personaId: "p-001", quantity: 1e308 },
  });
  expect(res.status()).toBe(400);
});

test("add rejects unsafe integers", async ({ request }) => {
  const h = await registerUser(request, "d01-b");
  const raw = await request.post(`${apiURL}/cart`, {
    headers: { ...h, "content-type": "application/json" },
    data: '{"personaId":"p-001","quantity":9007199254740993}',
  });
  expect(raw.status()).toBe(400);
  const res = await request.post(`${apiURL}/cart`, {
    headers: h,
    data: { personaId: "p-001", quantity: 2 ** 53 + 2 },
  });
  expect(res.status()).toBe(400);
});

test("update rejects quantity 1e308", async ({ request }) => {
  const h = await registerUser(request, "d01-c");
  const added = await request.post(`${apiURL}/cart`, {
    headers: h,
    data: { personaId: "p-001", quantity: 1 },
  });
  const itemId = (await added.json()).items[0].id as string;
  const res = await request.put(`${apiURL}/cart/${itemId}`, {
    headers: h,
    data: { quantity: 1e308 },
  });
  expect(res.status()).toBe(400);
});

test("merged quantity above MAX_SAFE_INTEGER is rejected and cart unchanged", async ({ request }) => {
  const h = await registerUser(request, "d01-d");
  const first = await request.post(`${apiURL}/cart`, {
    headers: h,
    data: { personaId: "p-001", quantity: MAX },
  });
  expect(first.status()).toBe(200);

  const second = await request.post(`${apiURL}/cart`, {
    headers: h,
    data: { personaId: "p-001", quantity: 1 },
  });
  expect(second.status()).toBe(400);
  expect((await second.json()).error).toBe("Quantity too large");

  const cart = await (await request.get(`${apiURL}/cart`, { headers: h })).json();
  expect(cart.items[0].quantity).toBe(MAX);
  expect(Number.isFinite(cart.total)).toBe(true);
});

test("normal add and checkout yields finite numeric total", async ({ request }) => {
  const h = await registerUser(request, "d01-e");
  const add = await request.post(`${apiURL}/cart`, {
    headers: h,
    data: { personaId: "p-001", quantity: 2 },
  });
  expect(add.status()).toBe(200);
  const res = await request.post(`${apiURL}/checkout`, {
    headers: h,
    data: { name: "Test User", email: "test@example.com" },
  });
  expect(res.status()).toBe(201);
  const order = await res.json();
  expect(typeof order.total).toBe("number");
  expect(Number.isFinite(order.total)).toBe(true);
});
