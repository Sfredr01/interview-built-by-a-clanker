import { test, expect, type APIRequestContext } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

// BUG-C05: checkout must never create an order with no items. A cart whose
// entries all point at missing personas used to yield 201 with items [] and
// total 0. Personas cannot be removed via the API, so the dangling case is
// verified by a throwaway fastify.inject script; these tests guard the
// reachable behaviour (valid checkout still works, empty cart still rejected).
async function registerUser(request: APIRequestContext, label: string) {
  const unique = `${label}${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const res = await request.post(`${apiURL}/auth/register`, {
    data: {
      username: unique.slice(0, 30),
      email: `${unique}@example.com`,
      password: "secret123",
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { Authorization: `Bearer ${body.token}` };
}

const customer = { name: "Test Buyer", email: "buyer@example.com" };

test("valid checkout still returns 201 with items and total", async ({ request }) => {
  const headers = await registerUser(request, "ordera");
  const add = await request.post(`${apiURL}/cart`, {
    headers,
    data: { personaId: "p-001", quantity: 2 },
  });
  expect(add.ok()).toBeTruthy();

  const res = await request.post(`${apiURL}/checkout`, { headers, data: customer });
  expect(res.status()).toBe(201);
  const order = await res.json();
  expect(order.items).toHaveLength(1);
  expect(order.items[0].personaId).toBe("p-001");
  expect(order.total).toBe(99.98);
});

test("empty cart checkout is rejected with 400 and no order", async ({ request }) => {
  const headers = await registerUser(request, "orderb");
  const res = await request.post(`${apiURL}/checkout`, { headers, data: customer });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe("Cart is empty");
});
