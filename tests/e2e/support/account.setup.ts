import { test } from '@playwright/test';
import { cleanup, seedDefaultAccount } from '../support/helper';

test('Prepare account fixture', async () => {
  await cleanup();
  await seedDefaultAccount();
});
