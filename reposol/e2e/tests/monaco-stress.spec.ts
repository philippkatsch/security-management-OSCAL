import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Monaco Editor JSON/Visual Dual-Mode Stress Testing', () => {
  test.setTimeout(120000);

  test('Stress 1: Rapid Dual-Mode Toggling (30 rapid mode switches)', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Rapid Toggle Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        { id: 'ac-1', title: 'Access Control Policy' },
        { id: 'ac-2', title: 'Account Management' }
      ]
    });

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    const jsonToggleBtn = page.getByRole('button', { name: /JSON/i });
    const visualToggleBtn = page.getByRole('button', { name: /Visual/i });

    await expect(jsonToggleBtn).toBeVisible({ timeout: 15000 });

    // Perform 30 rapid switches back and forth between Visual and JSON mode
    for (let i = 0; i < 15; i++) {
      await jsonToggleBtn.click();
      await visualToggleBtn.click();
    }

    // Verify after rapid toggling, UI is completely responsive and functional
    await jsonToggleBtn.click();
    const jsonContainer = page.locator('.json-editor-container');
    await expect(jsonContainer).toBeVisible({ timeout: 10000 });

    await visualToggleBtn.click();
    await expect(jsonContainer).toHaveCount(0, { timeout: 10000 });

    const controlItem = page.locator('[data-dnd-id="ac-1"]');
    await expect(controlItem).toBeVisible({ timeout: 10000 });
    await controlItem.click();
    await expect(page.getByText('Access Control Policy').first()).toBeVisible({ timeout: 10000 });
  });

  test('Stress 2: Data Synchronicity Under Editing & Rapid Mode Toggling', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Sync Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [{ id: 'ac-1', title: 'Original Policy Title' }]
    });

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    const jsonToggleBtn = page.getByRole('button', { name: /JSON/i });
    const visualToggleBtn = page.getByRole('button', { name: /Visual/i });

    await jsonToggleBtn.click();
    const jsonContainer = page.locator('.json-editor-container');
    await expect(jsonContainer).toBeVisible({ timeout: 10000 });

    // Wait for Monaco editor instance to initialize
    await page.waitForFunction(() => Boolean((window as any).monaco?.editor?.getEditors()?.length), { timeout: 15000 });

    // Edit catalog title in JSON mode
    await page.evaluate(() => {
      const monacoEditor = (window as any).monaco?.editor?.getEditors()?.[0];
      if (monacoEditor) {
        monacoEditor.setValue(JSON.stringify({
          catalog: {
            uuid: '00000000-0000-4000-8000-000000000000',
            metadata: {
              title: 'Modified Title Via Monaco',
              'last-modified': '2026-01-01T00:00:00Z',
              version: '1.0',
              'oscal-version': '1.1.0'
            },
            groups: [
              {
                id: 'ac',
                title: 'Access Control',
                controls: [{ id: 'ac-1', title: 'Updated Policy Title' }]
              }
            ]
          }
        }, null, 2));
      }
    });

    await page.waitForTimeout(500);

    // Rapidly toggle back and forth
    await visualToggleBtn.click();
    await expect(jsonContainer).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText('Modified Title Via Monaco').first()).toBeVisible({ timeout: 10000 });

    await jsonToggleBtn.click();
    await expect(jsonContainer).toBeVisible({ timeout: 10000 });

    await visualToggleBtn.click();
    await expect(page.getByText('Modified Title Via Monaco').first()).toBeVisible({ timeout: 10000 });

    const controlItem = page.locator('[data-dnd-id="ac-1"]');
    if (await controlItem.isVisible().catch(() => false)) {
      await controlItem.click();
      await expect(page.getByText('Updated Policy Title').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('Stress 3: Invalid JSON Syntax Alerts & View Hold Under Rapid Switch Attempts', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Syntax Alert Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [{ id: 'ac-1', title: 'Access Control Policy' }]
    });

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    const jsonToggleBtn = page.getByRole('button', { name: /JSON/i });
    const visualToggleBtn = page.getByRole('button', { name: /Visual/i });

    await jsonToggleBtn.click();
    const jsonContainer = page.locator('.json-editor-container');
    await expect(jsonContainer).toBeVisible({ timeout: 10000 });

    let dialogCount = 0;
    page.on('dialog', async (dialog) => {
      dialogCount++;
      expect(dialog.message()).toContain('JSON Syntax Error');
      await dialog.accept();
    });

    await page.waitForFunction(() => Boolean((window as any).monaco?.editor?.getEditors()?.length), { timeout: 15000 });

    // Set invalid JSON text
    await page.evaluate(() => {
      const monacoEditor = (window as any).monaco?.editor?.getEditors()?.[0];
      if (monacoEditor) {
        monacoEditor.setValue('{"catalog": { invalid_syntax_json');
      }
    });

    await expect(page.getByText(/Invalid JSON:/i)).toBeVisible({ timeout: 10000 });

    // Rapidly attempt 5 mode switch clicks while JSON is invalid
    for (let i = 0; i < 5; i++) {
      await visualToggleBtn.click();
    }

    // View hold should keep user in JSON view
    await expect(jsonContainer).toBeVisible({ timeout: 10000 });
    expect(dialogCount).toBeGreaterThanOrEqual(1);

    // Fix JSON text back to valid syntax
    await page.evaluate(() => {
      const monacoEditor = (window as any).monaco?.editor?.getEditors()?.[0];
      if (monacoEditor) {
        monacoEditor.setValue(JSON.stringify({
          catalog: {
            uuid: '00000000-0000-4000-8000-000000000000',
            metadata: { title: 'Recovered Valid Catalog', 'last-modified': '2026-01-01T00:00:00Z', version: '1.0', 'oscal-version': '1.1.0' },
            controls: [{ id: 'ac-1', title: 'Access Control Policy' }]
          }
        }, null, 2));
      }
    });

    // Successfully switch to Visual mode after fix
    await visualToggleBtn.click();
    await expect(jsonContainer).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText('Recovered Valid Catalog').first()).toBeVisible({ timeout: 10000 });
  });

  test('Stress 4: Schema Validation Error Handling & Rapid Schema Requests', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Schema Validation Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [{ id: 'ac-1', title: 'Access Control Policy' }]
    });

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    const jsonToggleBtn = page.getByRole('button', { name: /JSON/i });
    await jsonToggleBtn.click();

    const validateSchemaBtn = page.getByRole('button', { name: /Validate Schema/i });
    await expect(validateSchemaBtn).toBeVisible({ timeout: 10000 });

    // Click Validate Schema 5 times rapidly
    for (let i = 0; i < 5; i++) {
      await validateSchemaBtn.click();
    }

    // Verify app remains responsive and schema validation feedback appears or completes without crash
    await page.waitForTimeout(1000);
    const jsonContainer = page.locator('.json-editor-container');
    await expect(jsonContainer).toBeVisible({ timeout: 10000 });

    // Set invalid JSON and click validate schema
    await page.waitForFunction(() => Boolean((window as any).monaco?.editor?.getEditors()?.length), { timeout: 15000 });
    await page.evaluate(() => {
      const monacoEditor = (window as any).monaco?.editor?.getEditors()?.[0];
      if (monacoEditor) {
        monacoEditor.setValue('{"invalid_json": true,');
      }
    });

    await validateSchemaBtn.click();
    // App should handle syntax error gracefully in console.error without crashing UI
    await expect(jsonContainer).toBeVisible({ timeout: 10000 });
  });

  test('Stress 5: Large OSCAL Document Dual-Mode Toggling', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    // Create large catalog with 50 controls
    const largeControls = Array.from({ length: 50 }, (_, i) => ({
      id: `ac-${i + 1}`,
      title: `Access Control Policy Item ${i + 1}`,
      parts: [
        {
          id: `ac-${i + 1}_smt`,
          name: 'statement',
          prose: `Detailed policy statement for control ac-${i + 1} with extensive governance prose.`
        }
      ]
    }));

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Large Payload Catalog ${catalogUuid.substring(0, 8)}`,
      controls: largeControls
    });

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    const jsonToggleBtn = page.getByRole('button', { name: /JSON/i });
    const visualToggleBtn = page.getByRole('button', { name: /Visual/i });

    // Toggle back and forth 5 times with large document
    for (let i = 0; i < 5; i++) {
      await jsonToggleBtn.click();
      await expect(page.locator('.json-editor-container')).toBeVisible({ timeout: 15000 });
      await visualToggleBtn.click();
      await expect(page.locator('.json-editor-container')).toHaveCount(0, { timeout: 15000 });
    }

    await expect(page.getByText('Large Payload Catalog').first()).toBeVisible({ timeout: 10000 });
  });
});
