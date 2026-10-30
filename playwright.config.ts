import { defineConfig } from "@playwright/test";

// Ports differ from the dev servers (3001/5173) so tests never collide with them.
// Parallel worktrees override E2E_API_PORT / E2E_WEB_PORT.
const apiPort = Number(process.env.E2E_API_PORT ?? 4001);
const webPort = Number(process.env.E2E_WEB_PORT ?? 4173);
const apiURL = `http://localhost:${apiPort}`;
const webURL = `http://localhost:${webPort}`;

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: webURL,
    channel: "chrome",
  },
  metadata: { apiURL },
  webServer: [
    {
      command: "pnpm --filter @acme/api exec tsx src/index.ts",
      url: `${apiURL}/health`,
      env: { PORT: String(apiPort), WEB_ORIGIN: webURL },
      reuseExistingServer: false,
    },
    {
      command: "pnpm --filter @acme/web exec vite --strictPort",
      url: webURL,
      env: { WEB_PORT: String(webPort), VITE_API_URL: apiURL },
      reuseExistingServer: false,
    },
  ],
});
