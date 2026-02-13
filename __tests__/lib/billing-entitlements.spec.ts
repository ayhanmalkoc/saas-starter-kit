import { ApiError } from '@/lib/errors';
import {
  getTeamEntitlements,
  hasTeamEntitlement,
  requireTeamEntitlement,
} from '@/lib/billing/entitlements';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { getByTeamId } from 'models/subscription';

jest.mock('models/subscription', () => ({
  getByTeamId: jest.fn(),
}));

jest.mock('@/lib/env', () => ({
  teamFeatures: {
    payments: true,
  },
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    products: {
      retrieve: jest.fn(),
    },
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    price: {
      findUnique: jest.fn(),
    },
    service: {
      findUnique: jest.fn(),
    },
  },
}));

const mockedGetByTeamId = jest.mocked(getByTeamId);
const mockedRetrieve = jest.mocked(stripe.products.retrieve);
const mockedPriceFindUnique = jest.mocked(prisma.price.findUnique);
const mockedServiceFindUnique = jest.mocked(prisma.service.findUnique);

describe('lib/billing/entitlements', () => {
  beforeEach(() => {
    mockedGetByTeamId.mockReset();
    mockedRetrieve.mockReset();
    mockedPriceFindUnique.mockReset();
    mockedServiceFindUnique.mockReset();
  });

  it('merges active subscription entitlements from stripe and database', async () => {
    mockedGetByTeamId.mockResolvedValue([
      { status: 'active', productId: 'prod_1', priceId: 'price_1' },
      { status: 'trialing', productId: null, priceId: 'price_2' },
      { status: 'canceled', productId: 'prod_2', priceId: 'price_3' },
    ] as any);

    mockedRetrieve.mockResolvedValue({
      metadata: {
        features: 'Sso,Audit Logs',
        limits: 'members=3',
        limit_projects: '5',
      },
    } as any);

    mockedPriceFindUnique.mockResolvedValue({ serviceId: 'service_2' } as any);
    mockedServiceFindUnique.mockResolvedValue({
      features: ['Webhook'],
      metadata: {
        featureFlags: { Dsync: true },
        limits: { members: 10 },
      },
    } as any);

    const entitlements = await getTeamEntitlements('team_1');

    expect(entitlements).toEqual({
      features: {
        sso: true,
        audit_logs: true,
        webhook: true,
        dsync: true,
      },
      limits: {
        members: 10,
        projects: 5,
      },
      planIds: ['prod_1'],
      sources: ['stripe', 'database'],
    });
  });

  it('throws ApiError when required feature is missing', async () => {
    mockedGetByTeamId.mockResolvedValue([] as any);

    await expect(
      requireTeamEntitlement('team_2', { feature: 'SSO' })
    ).rejects.toEqual(
      expect.objectContaining<ApiError>({
        status: 403,
        message: 'Plan does not include required feature: SSO',
      })
    );
  });

  it('maps ApiError(403) to false in hasTeamEntitlement', async () => {
    mockedGetByTeamId.mockResolvedValue([] as any);

    await expect(
      hasTeamEntitlement('team_3', {
        limit: { key: 'members', minimum: 1 },
      })
    ).resolves.toBe(false);
  });

  it('rethrows unexpected errors in hasTeamEntitlement', async () => {
    mockedGetByTeamId.mockRejectedValue(new Error('storage-down'));

    await expect(
      hasTeamEntitlement('team_4', { feature: 'sso' })
    ).rejects.toThrow('storage-down');
  });

  describe('when payments feature is disabled', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.doMock('@/lib/env', () => ({
        teamFeatures: {
          payments: false,
        },
      }));
    });

    afterEach(() => {
      jest.resetModules();
    });

    it('returns true for limits when payments are disabled', async () => {
      // Re-import the module to pick up the new mock
      const { hasTeamEntitlement } = await import('@/lib/billing/entitlements');

      await expect(
        hasTeamEntitlement('team_5', {
          limit: { key: 'members', minimum: 100 },
        })
      ).resolves.toBe(true);
    });
  });
});
