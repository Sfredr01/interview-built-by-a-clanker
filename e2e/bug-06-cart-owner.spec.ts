import { test, expect, type APIRequestContext } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

async function registerUser(request: APIRequestContext, label: string) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const username = `${label}-${suffix}`.slice(0, 30);
  const res = await request.post(`${apiURL}/auth/register`, {
    data: {
      username,
      email: `${username}@example.com`,
      password: "password123",
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { Authorization: `Bearer ${body.token}` };
}

// BUG-C06: DELETE /cart/:itemId must only remove the caller's own items.
test("cart item can only be deleted by its owner", async ({ request }) => {
  const a = await registerUser(request, "own-a");
  const b = await registerUser(request, "own-b");

  const added = await request.post(`${apiURL}/cart`, {
    headers: a,
    data: { personaId: "p-001", quantity: 1 },
  });
  expect(added.ok()).toBeTruthy();
  const itemId = (await added.json()).items[0].id as string;

  // Another user cannot delete it, and cannot tell it exists.
  const foreign = await request.delete(`${apiURL}/cart/${itemId}`, { headers: b });
  expect(foreign.status()).toBe(404);

  const stillThere = await (await request.get(`${apiURL}/cart`, { headers: a })).json();
  expect(stillThere.items.map((i: { id: string }) => i.id)).toContain(itemId);

  // Owner can delete it.
  const own = await request.delete(`${apiURL}/cart/${itemId}`, { headers: a });
  expect(own.status()).toBe(200);
  const after = await (await request.get(`${apiURL}/cart`, { headers: a })).json();
  expect(after.items).toHaveLength(0);
});

test("deleting a nonexistent cart item returns 404", async ({ request }) => {
  const a = await registerUser(request, "own-c");
  const res = await request.delete(`${apiURL}/cart/cart-does-not-exist`, { headers: a });
  expect(res.status()).toBe(404);
});
