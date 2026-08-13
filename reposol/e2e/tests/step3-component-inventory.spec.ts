import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 3 Component Inventory — Extended Coverage', () => {
  test.setTimeout(90000);

  test('UC-3.5: Custom Properties & Free-Form Metadata', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition();
    
    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /Components/i }).click();
    
    await page.getByRole('button', { name: /Add Component/i }).click();
    await page.getByLabel(/Component Title/i).fill('Metadata Component');
    await page.getByLabel(/Component Type/i).fill('software');
    await page.getByRole('button', { name: /Save/i }).click();
    
    await expect(page.getByText('Metadata Component')).toBeVisible();
    
    await page.getByRole('button', { name: /Edit Metadata Component/i }).click();
    await page.getByRole('button', { name: /Add Property/i }).click();
    
    await page.getByLabel(/Property Name/i).fill('CustomProp');
    await page.getByLabel(/Property Value/i).fill('CustomValue');
    await page.getByLabel(/Namespace/i).fill('http://example.com/ns');
    await page.getByLabel(/Remarks/i).fill('Test remark');
    
    await page.getByRole('button', { name: /Save/i, exact: true }).click();
    await expect(page.getByText('CustomProp: CustomValue')).toBeVisible();
  });
  
  test('UC-3.7: Service Protocols & Port Ranges', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition();
    
    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /Components/i }).click();
    
    await page.getByRole('button', { name: /Add Component/i }).click();
    await page.getByLabel(/Component Title/i).fill('Service Component');
    await page.getByLabel(/Component Type/i).fill('service');
    await page.getByRole('button', { name: /Save/i }).click();
    
    await page.getByRole('button', { name: /Edit Service Component/i }).click();
    await page.getByRole('button', { name: /Add Protocol/i }).click();
    
    await page.getByLabel(/Protocol Name/i).fill('HTTPS');
    await page.getByLabel(/Protocol Title/i).fill('Secure Web HTTP');
    
    await page.getByRole('button', { name: /Add Port Range/i }).click();
    await page.getByLabel(/Start Port/i).fill('443');
    await page.getByLabel(/End Port/i).fill('443');
    await page.getByLabel(/Transport/i).fill('TCP');
    
    await page.getByRole('button', { name: /Save/i, exact: true }).click();
    
    await expect(page.getByText('HTTPS (Secure Web HTTP)')).toBeVisible();
    await expect(page.getByText('Port: 443-443 (TCP)')).toBeVisible();
  });
  
  test('UC-3.8: Organizational Roles & Responsible Parties', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition();
    
    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /Components/i }).click();
    
    await page.getByRole('button', { name: /Add Component/i }).click();
    await page.getByLabel(/Component Title/i).fill('Role Component');
    await page.getByLabel(/Component Type/i).fill('system');
    await page.getByRole('button', { name: /Save/i }).click();
    
    await page.getByRole('button', { name: /Edit Role Component/i }).click();
    await page.getByRole('button', { name: /Add Responsible Role/i }).click();
    
    await page.getByLabel(/Role ID/i).fill('admin-role');
    const partyId = randomUUID();
    await page.getByLabel(/Party UUID/i).fill(partyId);
    
    await page.getByRole('button', { name: /Save/i, exact: true }).click();
    await expect(page.getByText('admin-role')).toBeVisible();
    await expect(page.getByText(partyId)).toBeVisible();
  });
  
  test('UC-3.11: Statement-Level Implementation Detail', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition();
    
    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /Components/i }).click();
    
    await page.getByRole('button', { name: /Add Component/i }).click();
    await page.getByLabel(/Component Title/i).fill('Implementation Component');
    await page.getByLabel(/Component Type/i).fill('software');
    await page.getByRole('button', { name: /Save/i }).click();
    
    await page.getByRole('button', { name: /Edit Implementation Component/i }).click();
    await page.getByRole('button', { name: /Add Control Implementation/i }).click();
    
    await page.getByLabel(/Control ID/i).fill('ac-1');
    await page.getByLabel(/Description/i).fill('AC-1 implementation desc');
    
    await page.getByRole('button', { name: /Add Statement/i }).click();
    await page.getByLabel(/Statement ID/i).fill('ac-1_smt.a');
    await page.getByLabel(/Statement Description/i).fill('Statement A implementation');
    
    await page.getByRole('button', { name: /Save/i, exact: true }).click();
    
    await expect(page.getByText('ac-1_smt.a')).toBeVisible();
    await expect(page.getByText('Statement A implementation')).toBeVisible();
  });
  
  test('UC-3.13: Capability Declaration & Component Aggregation', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition();
    
    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /Components/i }).click();
    
    // Add sub-component
    await page.getByRole('button', { name: /Add Component/i }).click();
    await page.getByLabel(/Component Title/i).fill('Sub Component 1');
    await page.getByLabel(/Component Type/i).fill('software');
    await page.getByRole('button', { name: /Save/i }).click();
    
    await page.getByRole('button', { name: /Capabilities/i }).click();
    await page.getByRole('button', { name: /Add Capability/i }).click();
    
    await page.getByLabel(/Capability Name/i).fill('Advanced Auth');
    await page.getByLabel(/Description/i).fill('Handles advanced authentication');
    
    // Link incorporated component
    await page.getByRole('button', { name: /Link Component/i }).click();
    await page.getByLabel(/Select Component/i).selectOption({ label: 'Sub Component 1' });
    
    await page.getByRole('button', { name: /Save Capability/i }).click();
    
    await expect(page.getByText('Advanced Auth')).toBeVisible();
    await expect(page.getByText('Sub Component 1')).toBeVisible();
  });
  
  test('UC-3.14: External Component Definition Import / Reference', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition();
    
    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    
    await page.getByRole('button', { name: /Overview/i }).click();
    await page.getByRole('button', { name: /Add Import/i }).click();
    
    await page.getByLabel(/Href/i).fill('https://example.com/component-definition.json');
    await page.getByRole('button', { name: /Save Import/i }).click();
    
    await expect(page.getByText('https://example.com/component-definition.json')).toBeVisible();
  });
});
