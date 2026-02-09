// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`
// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Provide baseline env vars required by lib/env.ts fail-fast validation.
process.env.DATABASE_URL ||=
  'postgresql://postgres:postgres@localhost:5432/postgres';
process.env.APP_URL ||= 'http://localhost:4002';
process.env.NEXTAUTH_SECRET ||= 'test-nextauth-secret';

process.env.PGUSER =
  process.env.PGUSER === 'root' ? 'postgres' : process.env.PGUSER || 'postgres';
