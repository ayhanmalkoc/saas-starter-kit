import { ApiError } from '@/lib/errors';
import {
  createTeamSchema,
  ssoVerifySchema,
  updateTeamSchema,
  validateWithSchema,
} from '@/lib/zod';

describe('lib/zod schema validation', () => {
  it('validates payload and transforms slug for updateTeamSchema', () => {
    const payload = {
      name: 'Acme Team',
      slug: 'Acme Team 42',
      domain: 'example.com',
    };

    const parsed = validateWithSchema(updateTeamSchema, payload);

    expect(parsed).toEqual({
      name: 'Acme Team',
      slug: 'acme-team-42',
      domain: 'example.com',
    });
  });

  it('captures invalid createTeam payload as snapshot', () => {
    const result = createTeamSchema.safeParse({ name: '' });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.format()).toMatchSnapshot();
    }
  });

  it('captures valid ssoVerify payload as snapshot', () => {
    const result = ssoVerifySchema.safeParse({ email: 'owner@example.com', slug: '' });

    expect(result).toMatchSnapshot();
  });

  it('maps zod errors to ApiError with 422 status', () => {
    expect(() => validateWithSchema(createTeamSchema, { name: '' })).toThrow(
      new ApiError(422, 'Validation Error: Team Name is required')
    );
  });

  it('keeps ApiError status and message fields', () => {
    const error = new ApiError(409, 'Conflict');

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(409);
    expect(error.message).toBe('Conflict');
  });
});
