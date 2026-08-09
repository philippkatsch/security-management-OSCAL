/**
 * Playwright Global Teardown — Safety Net for Orphaned Test Workspaces
 *
 * Runs after all Playwright tests complete. Scans the backend data/workspaces/
 * directory and removes any UUID-named subdirectories that were not cleaned up
 * by individual test fixtures (e.g. from crashed tests or tests that don't use
 * the base fixture).
 *
 * The 'default' workspace is always preserved.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UUID_PREFIX_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROTECTED_NAMES = new Set(['default', 'master', 'templates']);

async function globalTeardown() {
  const workspacesDir = path.resolve(__dirname, '../backend/data/workspaces');

  if (!fs.existsSync(workspacesDir)) {
    return;
  }

  const entries = fs.readdirSync(workspacesDir, { withFileTypes: true });
  let removedCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (PROTECTED_NAMES.has(entry.name)) continue;

    // Only remove UUID-named directories (test workspaces)
    if (!UUID_PREFIX_REGEX.test(entry.name)) continue;

    const dirPath = path.join(workspacesDir, entry.name);
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      removedCount++;
    } catch (err) {
      console.warn(`[global-teardown] Failed to remove workspace ${entry.name}:`, err);
    }
  }

  if (removedCount > 0) {
    console.log(`[global-teardown] Removed ${removedCount} orphaned test workspace(s).`);
  }
}

export default globalTeardown;
