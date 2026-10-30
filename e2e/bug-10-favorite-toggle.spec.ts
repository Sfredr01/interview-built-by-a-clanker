import { test, expect } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

test.describe("BUG-C10 favorite toggle", () => {
  test("first click adds (POST), second click removes (DELETE)", async ({ page, request }) => {
    const unique = Math.random().toString(36).slice(2, 8);
    const reg = await request.post(`${apiURL}/auth/register`, {
      data: { username: `fav${unique}`, email: `fav-${Date.now()}-${unique}@example.com`, password: "secret1" },
    });
    expect(reg.status()).toBe(201);
    const { token } = await reg.json();
    const auth = { Authorization: `Bearer ${token}` };

    const errors: string[] = [];
    const favoriteStatuses: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (new URL(r.url()).pathname.startsWith("/favorites")) {
        favoriteStatuses.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`);
      }
    });

    await page.addInitScript((t) => localStorage.setItem("auth_token", t), token);
    await page.goto("/personas/p-001");

    const heart = page.locator('button:has(svg path[d^="M4.318"])');
    const icon = heart.locator("svg");
    await expect(heart).toBeVisible();
    await expect(icon).not.toHaveClass(/text-red-500/);

    const isMutation = (r: import("@playwright/test").Response) =>
      r.request().method() !== "GET" && new URL(r.url()).pathname.startsWith("/favorites");

    const [add] = await Promise.all([page.waitForResponse(isMutation), heart.click()]);
    expect(`${add.request().method()} ${new URL(add.url()).pathname}`).toBe("POST /favorites");
    expect(add.ok()).toBe(true);
    await expect(icon).toHaveClass(/text-red-500/);

    const list1 = await request.get(`${apiURL}/favorites`, { headers: auth });
    const ids1 = (await list1.json()).favorites.map((p: { id: string }) => p.id);
    expect(ids1).toContain("p-001");

    const [del] = await Promise.all([page.waitForResponse(isMutation), heart.click()]);
    expect(`${del.request().method()} ${new URL(del.url()).pathname}`).toBe("DELETE /favorites/p-001");
    expect(del.ok()).toBe(true);
    await expect(icon).not.toHaveClass(/text-red-500/);

    const list2 = await request.get(`${apiURL}/favorites`, { headers: auth });
    const ids2 = (await list2.json()).favorites.map((p: { id: string }) => p.id);
    expect(ids2).not.toContain("p-001");

    expect(favoriteStatuses.filter((s) => s.endsWith(" 404"))).toEqual([]);
    expect(errors).toEqual([]);
  });
});
