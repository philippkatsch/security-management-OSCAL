import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: './tests',
  globalTeardown: './global-teardown.ts',
  timeout: 60000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: 'http://127.0.0.1:1001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: [
    {
      command: 'C:\\Users\\phili\\miniconda3\\envs\\darkspell\\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 1000',
      cwd: path.resolve(__dirname, '../backend'),
      url: 'http://127.0.0.1:1000/health',
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 60000,
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 1001',
      cwd: path.resolve(__dirname, '../frontend'),
      url: 'http://127.0.0.1:1001',
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 60000,
    },
  ],
});

