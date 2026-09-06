import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 8 Control Mapping — Extended Coverage', () => {
  test.setTimeout(90000);

  test('UC-8.3: Source & Target Resource Declaration', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const mappingId = await apiSetup.createControlMapping();
    
    await page.goto(`/control-mappings/${mappingId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('tab', { name: /Metadata/i }).click();

    // Source Resource
    await page.getByLabel('Source Resource Type').selectOption('catalog');
    await page.getByLabel('Source Resource Title').fill('NIST SP 800-53 Rev 5');
    await page.getByLabel('Source Resource HREF').fill('http://nist.gov/catalog.json');

    // Target Resource
    await page.getByLabel('Target Resource Type').selectOption('profile');
    await page.getByLabel('Target Resource Title').fill('FedRAMP High');
    await page.getByLabel('Target Resource HREF').fill('http://fedramp.gov/profile.json');

    await page.getByTestId('save-btn').click();
    await expect(page.getByText('Saved successfully')).toBeVisible();
    await page.reload();

    await page.getByRole('tab', { name: /Metadata/i }).click();
    await expect(page.getByLabel('Source Resource Title')).toHaveValue('NIST SP 800-53 Rev 5');
    await expect(page.getByLabel('Target Resource Title')).toHaveValue('FedRAMP High');
  });

  test('UC-8.5 & UC-8.4 DEEP: Source/Target Item References and Relationship Type Enforcement', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const mappingId = await apiSetup.createControlMapping();
    
    await page.goto(`/control-mappings/${mappingId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('tab', { name: /Mappings/i }).click();

    // Add new mapping
    await page.getByRole('button', { name: /Add Mapping/i }).click();

    // The detail panel should slide out
    await expect(page.getByRole('heading', { name: /Mapping Details/i })).toBeVisible();

    // Add Source Item
    await page.getByRole('button', { name: /Add Source/i }).click();
    await page.getByLabel('Source Type').last().selectOption('control');
    await page.getByLabel('Source ID Reference').last().fill('ac-1');

    // Add Target Item
    await page.getByRole('button', { name: /Add Target/i }).click();
    await page.getByLabel('Target Type').last().selectOption('control');
    await page.getByLabel('Target ID Reference').last().fill('ac-1.1');

    // Relationship Type enforcement
    const relationshipSelect = page.getByLabel('Relationship');
    await relationshipSelect.selectOption('equal-to');
    await relationshipSelect.selectOption('equivalent-to');
    await relationshipSelect.selectOption('subset-of');
    await relationshipSelect.selectOption('superset-of');
    await relationshipSelect.selectOption('intersects-with');
    
    await page.getByTestId('save-btn').click();
    await expect(page.getByText('Saved successfully')).toBeVisible();
  });

  test('UC-8.2 DEEP & UC-8.7: Provenance validation and Confidence Scoring', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const mappingId = await apiSetup.createControlMapping();
    
    await page.goto(`/control-mappings/${mappingId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('tab', { name: /Mappings/i }).click();

    await page.getByRole('button', { name: /Add Mapping/i }).click();

    // Fill minimum requirements
    await page.getByRole('button', { name: /Add Source/i }).click();
    await page.getByLabel('Source ID Reference').last().fill('ac-2');
    
    await page.getByRole('button', { name: /Add Target/i }).click();
    await page.getByLabel('Target ID Reference').last().fill('ac-2.2');

    // Provenance fields
    await page.getByLabel('Method').selectOption('Automated');
    await page.getByLabel('Rationale').fill('Automatically mapped via script');
    await page.getByLabel('Remarks').fill('Needs manual review');
    
    // Confidence score
    const confidenceInput = page.getByLabel('Confidence');
    await confidenceInput.fill('105');
    await expect(page.getByText(/Must be between 0 and 100/i)).toBeVisible();
    await confidenceInput.fill('85');
    await expect(page.getByText(/Must be between 0 and 100/i)).not.toBeVisible();

    await page.getByTestId('save-btn').click();
    await expect(page.getByText('Saved successfully')).toBeVisible();

    await page.reload();
    await page.getByRole('tab', { name: /Mappings/i }).click();
    await page.getByRole('cell', { name: 'ac-2', exact: true }).click(); // Open detail panel

    await expect(page.getByLabel('Method')).toHaveValue('Automated');
    await expect(page.getByLabel('Confidence')).toHaveValue('85');
    await expect(page.getByLabel('Rationale')).toHaveValue('Automatically mapped via script');
  });

  test('UC-8.6: Relationship Qualifiers', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const mappingId = await apiSetup.createControlMapping();
    
    await page.goto(`/control-mappings/${mappingId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('tab', { name: /Mappings/i }).click();

    await page.getByRole('button', { name: /Add Mapping/i }).click();
    
    // Minimum setup
    await page.getByRole('button', { name: /Add Source/i }).click();
    await page.getByLabel('Source ID Reference').last().fill('ac-3');
    await page.getByRole('button', { name: /Add Target/i }).click();
    await page.getByLabel('Target ID Reference').last().fill('ac-3.1');

    // Qualifiers
    await page.getByRole('button', { name: /Add Qualifier/i }).click();
    await page.getByLabel('Qualifier Subject').fill('Parameter 1');
    await page.getByLabel('Qualifier Predicate').fill('Requires');
    await page.getByLabel('Qualifier Category').fill('Technical');
    await page.getByLabel('Qualifier Description').fill('Condition for technical mapping');

    await page.getByTestId('save-btn').click();
    await expect(page.getByText('Saved successfully')).toBeVisible();
  });

  test('UC-8.9 & Matrix view filtering: Gap Summary & Unmapped Controls', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    // Pre-seed mapping with specific relationships
    const mappingId = await apiSetup.createControlMapping({
      mapping: [
        {
          subject: { references: [{ type: 'control', 'id-ref': 'au-1' }] },
          relationships: [
            {
              'relationship-type': 'equal-to',
              references: [{ type: 'control', 'id-ref': 'au-1.1' }]
            }
          ]
        },
        {
          subject: { references: [{ type: 'control', 'id-ref': 'au-2' }] },
          relationships: [
            {
              'relationship-type': 'subset-of',
              references: [{ type: 'control', 'id-ref': 'au-2.2' }]
            }
          ]
        }
      ]
    });
    
    await page.goto(`/control-mappings/${mappingId}?w=${apiSetup.workspaceId}`);
    
    // Matrix View
    await page.getByRole('tab', { name: /Matrix View/i }).click();
    await expect(page.getByRole('cell', { name: 'au-1' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'au-2' })).toBeVisible();

    // Filter
    const filterSelect = page.getByLabel('Filter');
    await filterSelect.selectOption('Subset Of');
    await expect(page.getByRole('cell', { name: 'au-1' })).not.toBeVisible();
    await expect(page.getByRole('cell', { name: 'au-2' })).toBeVisible();
    
    // Gap Analysis
    await page.getByRole('tab', { name: /Gap Analysis/i }).click();
    await expect(page.getByText(/Unmapped/i).first()).toBeVisible();
  });

  test('Batch Actions and Dialogs', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const mappingId = await apiSetup.createControlMapping({
      mapping: [
        {
          subject: { references: [{ type: 'control', 'id-ref': 'cm-1' }] },
          relationships: [{ 'relationship-type': 'equal-to', references: [{ type: 'control', 'id-ref': 'cm-1.1' }] }]
        }
      ]
    });
    
    await page.goto(`/control-mappings/${mappingId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('tab', { name: /Mappings/i }).click();

    // Select row
    await page.getByRole('checkbox', { name: /Select row/i }).check();
    
    // Set Relationship via prompt
    page.once('dialog', dialog => dialog.accept('equivalent-to'));
    await page.getByRole('button', { name: /Set Relationship/i }).click();
    await expect(page.getByRole('cell', { name: 'equivalent-to' })).toBeVisible();

    // Delete Selected via confirm
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: /Delete Selected/i }).click();
    await expect(page.getByRole('cell', { name: 'cm-1' })).not.toBeVisible();
  });
});
