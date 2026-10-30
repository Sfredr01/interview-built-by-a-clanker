import { test, expect } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

// BUG-C19: /personas must validate its query string instead of silently ignoring bad values.
async function list(request: any, query: string) {
  const res = await request.get(`${apiURL}/personas${query}`);
  expect(res.status()).toBe(200);
  return (await res.json()) as Array<{ name: string; specialty: string; price: number }>;
}

for (const query of ["?minPrice=abc", "?maxPrice=abc", "?sort=bogus", "?tier=Platinum", "?specialty=Nope"]) {
  test(`${query} is rejected with 400`, async ({ request }) => {
    const res = await request.get(`${apiURL}/personas${query}`);
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBeTruthy();
  });
}

test("no params returns all 15 personas", async ({ request }) => {
  expect(await list(request, "")).toHaveLength(15);
});

test("specialty filter returns only that specialty", async ({ request }) => {
  const result = await list(request, "?specialty=Security");
  expect(result.length).toBeGreaterThan(0);
  for (const p of result) expect(p.specialty).toBe("Security");
});

test("sort=price-asc is ascending", async ({ request }) => {
  const prices = (await list(request, "?sort=price-asc")).map((p) => p.price);
  expect(prices).toEqual([...prices].sort((a, b) => a - b));
});

test("minPrice and maxPrice bound the range", async ({ request }) => {
  const result = await list(request, "?minPrice=60&maxPrice=70");
  expect(result.length).toBeGreaterThan(0);
  for (const p of result) {
    expect(p.price).toBeGreaterThanOrEqual(60);
    expect(p.price).toBeLessThanOrEqual(70);
  }
});

test("q search is non-empty and case-insensitive", async ({ request }) => {
  const result = await list(request, "?q=rex");
  expect(result.length).toBeGreaterThan(0);
  expect(await list(request, "?q=REX")).toEqual(result);
});
