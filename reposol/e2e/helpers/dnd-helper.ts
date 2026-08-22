import { Page, Locator } from '@playwright/test';

/**
 * Simulates HTML5 drag and drop with DataTransfer payload support across browser engines.
 */
export async function simulateHtml5DragAndDrop(
  page: Page,
  source: Locator | string,
  target: Locator | string,
  payload: { text: string; draggedType?: string; catalogUuid?: string }
) {
  const srcLocator = typeof source === 'string' ? page.locator(source).first() : source.first();
  const tgtLocator = typeof target === 'string' ? page.locator(target).first() : target.first();

  await srcLocator.waitFor({ state: 'visible', timeout: 15000 });
  await tgtLocator.waitFor({ state: 'visible', timeout: 15000 });

  await page.evaluate(
    ({ srcSelector, tgtSelector, data }) => {
      const srcEl = document.querySelector(srcSelector) as HTMLElement;
      const tgtEl = document.querySelector(tgtSelector) as HTMLElement;

      if (!srcEl || !tgtEl) {
        throw new Error(`Drag-and-drop elements not found in DOM: src=${srcSelector}, tgt=${tgtSelector}`);
      }

      // Create synthetic DataTransfer object
      const dataStore: Record<string, string> = {
        'text/plain': data.text,
        'draggedType': data.draggedType || 'control',
        'catalogUuid': data.catalogUuid || ''
      };

      const dataTransfer = {
        data: dataStore,
        setData(format: string, val: string) { this.data[format] = val; },
        getData(format: string) { return this.data[format] || ''; },
        types: Object.keys(dataStore),
        dropEffect: 'move' as const,
        effectAllowed: 'all' as const,
        clearData() { this.data = {}; },
        files: [] as unknown as FileList,
        items: [] as unknown as DataTransferItemList,
        setDragImage() {}
      };

      // 1. Dispatch dragstart on source
      const dragStartEvt = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer as unknown as DataTransfer
      });
      srcEl.dispatchEvent(dragStartEvt);

      // 2. Dispatch dragover on target
      const dragOverEvt = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer as unknown as DataTransfer
      });
      tgtEl.dispatchEvent(dragOverEvt);

      // 3. Dispatch drop on target
      const dropEvt = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer as unknown as DataTransfer
      });
      tgtEl.dispatchEvent(dropEvt);

      // 4. Dispatch dragend on source
      const dragEndEvt = new DragEvent('dragend', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer as unknown as DataTransfer
      });
      srcEl.dispatchEvent(dragEndEvt);
    },
    {
      srcSelector: typeof source === 'string' ? source : await getSelector(srcLocator),
      tgtSelector: typeof target === 'string' ? target : await getSelector(tgtLocator),
      data: payload
    }
  );
}

async function getSelector(locator: Locator): Promise<string> {
  const id = await locator.getAttribute('data-dnd-id');
  if (id) return `[data-dnd-id="${id}"]`;

  const testId = await locator.getAttribute('data-testid');
  if (testId) return `[data-testid="${testId}"]`;

  const className = await locator.getAttribute('class');
  if (className?.includes('sources-panel')) return '.sources-panel';

  return 'body';
}
