import { test, expect } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

// BUG-C07: minPrice filter must keep personas priced at or above the minimum.
async function prices(request: any, query: string): Promise<number[]> {
  const res = await request.get(`${apiURL}/personas${query}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  const list = Array.isArray(body) ? body : (body.personas ?? body.items ?? body.data);
  return list.map((p: { price: number }) => p.price);
}

test("minPrice=60 returns only personas priced >= 60", async ({ request }) => {
  const result = await prices(request, "?minPrice=60");
  expect(result.length).toBeGreaterThan(0);
  for (const price of result) expect(price).toBeGreaterThanOrEqual(60);
});

test("minPrice and maxPrice together bound the range", async ({ request }) => {
  const result = await prices(request, "?minPrice=60&maxPrice=70");
  expect(result.length).toBeGreaterThan(0);
  for (const price of result) {
    expect(price).toBeGreaterThanOrEqual(60);
    expect(price).toBeLessThanOrEqual(70);
  }
});

test("persona priced exactly at minPrice is included", async ({ request }) => {
  const all = await prices(request, "");
  const target = all[0];
  const result = await prices(request, `?minPrice=${target}`);
  expect(result).toContain(target);
});
