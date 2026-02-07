import { test as teardown } from '@playwright/test';
import { cleanup } from './helper';

teardown('delete database', async () => {
  await cleanup();
});
