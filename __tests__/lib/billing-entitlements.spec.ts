import { ApiError } from '@/lib/errors';
import {
  getOrganizationEntitlements,
  hasOrganizationEntitlement,
  requireOrganizationEntitlement,
} from '@/lib/billing/entitlements';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { getByBillingScope } from 'models/subscription';

jest.mock('models/subscription', () => ({
  getByBillingScope: jest.fn(),
}));

jest.mock('@/lib/env', () => ({
  workspaceFeatures: {
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
      findMany: jest.fn(),
    },
  },
}));

const mockedGetByBillingScope = jest.mocked(getByBillingScope);
const mockedRetrieve = jest.mocked(stripe.products.retrieve);
const mockedPriceFindUnique = jest.mocked(prisma.price.findUnique);
const mockedServiceFindMany = jest.mocked(prisma.service.findMany);

describe('lib/billing/entitlements', () => {
  beforeEach(() => {
    mockedGetByBillingScope.mockReset();
    mockedRetrieve.mockReset();
    mockedPriceFindUnique.mockReset();
    mockedServiceFindMany.mockReset();
    mockedServiceFindMany.mockResolvedValue([]);
    mockedPriceFindUnique.mockResolvedValue(null as any);
    mockedRetrieve.mockResolvedValue({ metadata: {} } as any);
  });

  it('uses authoritative active subscription entitlements', async () => {
    mockedGetByBillingScope.mockResolvedValue([
      {
        status: 'active',
        productId: 'prod_1',
        priceId: 'price_1',
        currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-12-30T00:00:00.000Z'),
      },
      {
        status: 'trialing',
        productId: null,
        priceId: 'price_2',
        currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-15T00:00:00.000Z'),
      },
      {
        status: 'canceled',
        productId: 'prod_2',
        priceId: 'price_3',
        currentPeriodEnd: new Date('2025-11-01T00:00:00.000Z'),
        updatedAt: new Date('2025-10-01T00:00:00.000Z'),
      },
    ] as any);

    mockedRetrieve.mockResolvedValue({
      metadata: {
        features: 'Sso,Audit Logs',
        limits: 'members=3',
        limit_projects: '5',
      },
    } as any);

    mockedPriceFindUnique.mockImplementation(async ({ where }) => {
      if (where.id === 'price_2') {
        return { serviceId: 'service_2' } as any;
      }
      return null;
    });
    mockedServiceFindMany.mockResolvedValue([
      {
        id: 'service_free',
        name: 'Free',
        features: ['api_keys'],
        metadata: {
          tier: 'personal',
          planLevel: 0,
          isDefault: true,
        },
      },
      {
        id: 'service_2',
        name: 'Project',
        features: ['Webhook'],
        metadata: {
          featureFlags: { Dsync: true },
          limits: { members: 10 },
          tier: 'business',
          planLevel: 10,
        },
      },
    ] as any);

    const entitlements = await getOrganizationEntitlements('org_1');

    expect(entitlements).toEqual({
      features: {
        webhooks: true,
        directory_sync: true,
      },
      limits: {
        members: 10,
      },
      planIds: ['service_2'],
      sources: ['database'],
    });
  });

  it('throws ApiError when required feature is missing', async () => {
    mockedGetByBillingScope.mockResolvedValue([] as any);

    await expect(
      requireOrganizationEntitlement('org_2', { feature: 'SSO' })
    ).rejects.toEqual(
      expect.objectContaining<ApiError>({
        status: 403,
        message: 'Plan does not include required feature: SSO',
      })
    );
  });

  it('uses default plan entitlements when there is no active subscription', async () => {
    mockedGetByBillingScope.mockResolvedValue([] as any);
    mockedServiceFindMany.mockResolvedValue([
      {
        id: 'service_free',
        name: 'Free',
        features: ['api_keys'],
        metadata: {
          tier: 'personal',
          planLevel: 0,
          isDefault: true,
        },
      },
      {
        id: 'service_basic',
        name: 'Basic',
        features: ['more_storage'],
        metadata: {
          tier: 'personal',
          planLevel: 1,
          inherits: ['Free'],
        },
      },
    ] as any);

    const entitlements = await getOrganizationEntitlements('org_default');

    expect(entitlements).toEqual({
      features: { api_keys: true },
      limits: {},
      planIds: ['service_free'],
      sources: ['free_tier'],
    });
  });

  it('resolves inherited features for database-backed plans', async () => {
    mockedGetByBillingScope.mockResolvedValue([
      { status: 'active', productId: null, priceId: 'price_pro' },
    ] as any);
    mockedPriceFindUnique.mockResolvedValue({
      serviceId: 'service_pro',
    } as any);
    mockedServiceFindMany.mockResolvedValue([
      {
        id: 'service_free',
        name: 'Free',
        features: ['api_keys'],
        metadata: {
          tier: 'personal',
          planLevel: 0,
          isDefault: true,
        },
      },
      {
        id: 'service_basic',
        name: 'Basic',
        features: ['more_storage'],
        metadata: {
          tier: 'personal',
          planLevel: 1,
          inherits: ['Free'],
        },
      },
      {
        id: 'service_pro',
        name: 'Pro',
        features: ['advanced_analytics'],
        metadata: {
          tier: 'personal',
          planLevel: 2,
          inherits: ['Basic'],
        },
      },
    ] as any);

    const entitlements = await getOrganizationEntitlements('org_inherited');

    expect(entitlements).toEqual({
      features: {
        api_keys: true,
        more_storage: true,
        advanced_analytics: true,
      },
      limits: {},
      planIds: ['service_pro'],
      sources: ['database'],
    });
  });

  it('maps ApiError(403) to false in hasOrganizationEntitlement', async () => {
    mockedGetByBillingScope.mockResolvedValue([] as any);

    await expect(
      hasOrganizationEntitlement('org_3', {
        limit: { key: 'members', minimum: 1 },
      })
    ).resolves.toBe(false);
  });

  it('rethrows unexpected errors in hasOrganizationEntitlement', async () => {
    mockedGetByBillingScope.mockRejectedValue(new Error('storage-down'));

    await expect(
      hasOrganizationEntitlement('org_4', { feature: 'sso' })
    ).rejects.toThrow('storage-down');
  });

  describe('when payments feature is disabled', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.doMock('@/lib/env', () => ({
        workspaceFeatures: {
          payments: false,
        },
      }));
    });

    afterEach(() => {
      jest.resetModules();
    });

    it('returns true for limits when payments are disabled', async () => {
      // Re-import the module to pick up the new mock
      const { hasOrganizationEntitlement } =
        await import('@/lib/billing/entitlements');

      await expect(
        hasOrganizationEntitlement('org_5', {
          limit: { key: 'members', minimum: 100 },
        })
      ).resolves.toBe(true);
    });
  });
});
