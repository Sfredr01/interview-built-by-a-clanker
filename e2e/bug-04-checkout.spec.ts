import { test, expect, type APIRequestContext } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

// BUG-C04: a successful checkout must empty the user's cart, so a repeat
// POST /checkout hits the "Cart is empty" guard instead of duplicating the order.
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

test("checkout empties cart; repeat checkout is rejected", async ({ request }) => {
  const headers = await registerUser(request, "usera");

  const add = await request.post(`${apiURL}/cart`, {
    headers,
    data: { personaId: "p-001", quantity: 2 },
  });
  expect(add.ok()).toBeTruthy();

  const first = await request.post(`${apiURL}/checkout`, { headers, data: customer });
  expect(first.status()).toBe(201);
  const order = await first.json();
  expect(order.items).toHaveLength(1);
  expect(order.total).toBe(99.98);

  const cart = await request.get(`${apiURL}/cart`, { headers });
  expect(await cart.json()).toMatchObject({ items: [], total: 0 });

  const second = await request.post(`${apiURL}/checkout`, { headers, data: customer });
  expect(second.status()).toBe(400);
  expect((await second.json()).error).toBe("Cart is empty");
});

test("checkout does not clear another user's cart", async ({ request }) => {
  const headersA = await registerUser(request, "usera");
  const headersB = await registerUser(request, "userb");

  for (const headers of [headersA, headersB]) {
    const add = await request.post(`${apiURL}/cart`, {
      headers,
      data: { personaId: "p-001", quantity: 1 },
    });
    expect(add.ok()).toBeTruthy();
  }

  const checkout = await request.post(`${apiURL}/checkout`, { headers: headersA, data: customer });
  expect(checkout.status()).toBe(201);

  const cartB = await (await request.get(`${apiURL}/cart`, { headers: headersB })).json();
  expect(cartB.items).toHaveLength(1);
});
