import { ApiError } from '@/lib/errors';
import {
  createProjectSchema,
  ssoVerifySchema,
  updateProjectSchema,
  validateWithSchema,
  webhookEndpointSchema,
} from '@/lib/zod';

describe('lib/zod schema validation', () => {
  it('validates payload and transforms slug for updateProjectSchema', () => {
    const payload = {
      name: 'Acme Project',
      slug: 'Acme Project 42',
      domain: 'example.com',
    };

    const parsed = validateWithSchema(updateProjectSchema, payload);

    expect(parsed).toEqual({
      name: 'Acme Project',
      slug: 'acme-project-42',
      domain: 'example.com',
    });
  });

  it('captures invalid createProject payload as snapshot', () => {
    const result = createProjectSchema.safeParse({ name: '' });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.format()).toMatchSnapshot();
    }
  });

  it('captures valid ssoVerify payload as snapshot', () => {
    const result = ssoVerifySchema.safeParse({
      email: 'owner@example.com',
      projectSlug: '',
    });

    expect(result).toMatchSnapshot();
  });

  it('maps zod errors to ApiError with 422 status', () => {
    expect(() => validateWithSchema(createProjectSchema, { name: '' })).toThrow(
      new ApiError(422, 'Validation Error: Project Name is required')
    );
  });

  it('accepts only https webhook endpoint URLs in webhookEndpointSchema', () => {
    const httpResult = webhookEndpointSchema.safeParse({
      name: 'Orders',
      url: 'http://example.com/webhooks',
      eventTypes: ['order.created'],
    });

    const httpsResult = webhookEndpointSchema.safeParse({
      name: 'Orders',
      url: 'https://example.com/webhooks',
      eventTypes: ['order.created'],
    });

    expect(httpResult.success).toBe(false);
    expect(httpsResult.success).toBe(true);

    if (!httpResult.success) {
      expect(httpResult.error.issues[0]?.message).toBe(
        'Webhook URL must use HTTPS protocol.'
      );
    }
  });

  it('keeps ApiError status and message fields', () => {
    const error = new ApiError(409, 'Conflict');

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(409);
    expect(error.message).toBe('Conflict');
  });
});
