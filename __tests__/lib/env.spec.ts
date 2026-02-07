import { toBooleanEnv } from '../../lib/env';

describe('lib/env toBooleanEnv', () => {
  it('returns false for undefined', () => {
    expect(toBooleanEnv(undefined)).toBe(false);
  });

  it('returns true for "true"', () => {
    expect(toBooleanEnv('true')).toBe(true);
  });

  it('returns false for "false"', () => {
    expect(toBooleanEnv('false')).toBe(false);
  });

  it('returns false for unexpected string values', () => {
    expect(toBooleanEnv('1')).toBe(false);
    expect(toBooleanEnv('yes')).toBe(false);
    expect(toBooleanEnv('TRUE')).toBe(false);
  });
});
