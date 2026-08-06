import { test as base, expect, type Page } from '@playwright/test';
import { ApiSetup } from '../helpers/api-setup';

type Fixtures = {
  apiSetup: ApiSetup;
};

export const test = base.extend<Fixtures>({
  apiSetup: async ({ page }, use) => {
    const setup = new ApiSetup(page);
    await use(setup);
    await setup.cleanup();
  },
});

export { expect };
