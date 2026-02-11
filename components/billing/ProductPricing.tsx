import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from 'react-daisyui';
import { useTranslation } from 'next-i18next';

import useTeam from 'hooks/useTeam';
import { Price, Prisma, Service, Subscription } from '@prisma/client';
import PaymentButton from './PaymentButton';
import { handlePlanChange } from './planService';

interface ProductPricingProps {
  plans: any[];
  subscriptions: (Subscription & { product: Service })[];
}

const ProductPricing = ({ plans, subscriptions }: ProductPricingProps) => {
  const { team } = useTeam();
  const { t } = useTranslation('common');
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>(
    'month'
  );
  const [tier, setTier] = useState<'personal' | 'business'>('personal');

  const initiatePlanChange = async (
    priceId: string,
    quantity?: number,
    subscriptionId?: string | null
  ) => {
    if (!team?.slug) {
      toast.error(t('stripe-checkout-fallback-error'));
      return;
    }

    const data = await handlePlanChange({
      teamSlug: team.slug,
      priceId,
      quantity,
      subscriptionId,
    });

    if (data?.data?.url) {
      window.open(data.data.url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (data?.data?.id) {
      toast.success(t('successfully-updated'));
      return;
    }

    toast.error(
      data?.error?.message ||
        data?.error?.raw?.message ||
        t('stripe-checkout-fallback-error')
    );
  };

  const hasActiveSubscription = (priceId: string) =>
    subscriptions.some((s) => s.priceId === priceId);

  const activeSubscription =
    subscriptions.find((subscription) =>
      ['active', 'trialing', 'past_due', 'incomplete'].includes(
        subscription.status
      )
    ) ?? subscriptions[0];

  const isSeatBasedPrice = (price: Price) => {
    const metadata = price.metadata as Prisma.JsonObject;
    const recurring = metadata?.recurring as Prisma.JsonObject | undefined;
    const usageType =
      (recurring?.usage_type as string | undefined) ??
      (metadata?.usage_type as string | undefined);

    return (
      (price.billingScheme === 'per_unit' ||
        price.billingScheme === 'tiered') &&
      usageType !== 'metered'
    );
  };

  const filteredPlans = plans.filter((plan) => {
    const metadata = plan.metadata as { tier?: string };
    const planTier = metadata.tier || 'personal'; // Default to personal if missing
    return planTier === tier;
  });

  return (
    <section className="py-3 max-w-5xl mx-auto">
      <div className="flex flex-col items-center justify-center mb-8 space-y-6">
        {/* Tier Tabs */}
        <div className="tabs tabs-boxed p-1 bg-gray-100 rounded-full">
          <a
            className={`tab tab-lg rounded-full px-8 ${tier === 'personal' ? 'tab-active bg-white text-black shadow-sm' : ''}`}
            onClick={() => setTier('personal')}
          >
            {t('personal')}
          </a>
          <a
            className={`tab tab-lg rounded-full px-8 ${tier === 'business' ? 'tab-active bg-white text-black shadow-sm' : ''}`}
            onClick={() => setTier('business')}
          >
            {t('business')}
          </a>
        </div>

        {/* Billing Interval Toggle */}
        <div className="flex items-center space-x-4 bg-gray-50 p-2 rounded-lg border">
          <span
            className={`cursor-pointer text-sm font-medium ${billingInterval === 'month' ? 'text-black' : 'text-gray-500'}`}
            onClick={() => setBillingInterval('month')}
          >
            {t('monthly')}
          </span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={billingInterval === 'year'}
            onChange={() =>
              setBillingInterval((prev) =>
                prev === 'month' ? 'year' : 'month'
              )
            }
          />
          <span
            className={`cursor-pointer text-sm font-medium ${billingInterval === 'year' ? 'text-black' : 'text-gray-500'}`}
            onClick={() => setBillingInterval('year')}
          >
            {t('yearly')}{' '}
            <span className="badge badge-sm badge-accent ml-1">
              {t('save-20')}
            </span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {filteredPlans.map((plan) => {
          const price = plan.prices.find((p: Price) => {
            const recurring =
              (p.metadata as any)?.recurring || (p as any).recurring;
            return recurring?.interval === billingInterval;
          });

          if (!price) return null;

          const metadata = plan.metadata as { recommended?: boolean };
          const isRecommended = metadata.recommended;

          return (
            <div
              className={`relative flex flex-col rounded-2xl border ${isRecommended ? 'border-primary shadow-lg ring-1 ring-primary' : 'border-gray-200 bg-white'}`}
              key={plan.id}
            >
              {isRecommended && (
                <div className="absolute -top-4 left-0 right-0 mx-auto w-32 rounded-full bg-primary px-3 py-1 text-center text-xs font-medium text-white">
                  {t('most-popular')}
                </div>
              )}

              <div className="p-6 flex-1">
                <h3 className="font-display text-xl font-bold text-black">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm text-gray-500 h-10 line-clamp-2">
                  {plan.description}
                </p>

                <div className="mt-4 flex items-baseline">
                  <span className="text-3xl font-bold tracking-tight text-gray-900">
                    ${(price.amount || 0) / 100}
                  </span>
                  <span className="ml-1 text-sm font-semibold text-gray-500">
                    /{billingInterval} {tier === 'business' ? '/ user' : ''}
                  </span>
                </div>

                <ul className="mt-6 space-y-4">
                  {plan.features.map((feature: string) => (
                    <li
                      className="flex space-x-3"
                      key={`${plan.id}-${feature}`}
                    >
                      <svg
                        className="h-5 w-5 flex-none text-primary"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 pt-0 mt-auto">
                {hasActiveSubscription(price.id) ? (
                  <Button
                    variant="outline"
                    fullWidth
                    disabled
                    className="rounded-xl"
                  >
                    {t('current')}
                  </Button>
                ) : (
                  <PaymentButton
                    plan={plan}
                    price={price}
                    onPlanChange={(priceId, quantity) => {
                      initiatePlanChange(
                        priceId,
                        isSeatBasedPrice(price)
                          ? (activeSubscription?.quantity ?? quantity ?? 1)
                          : undefined,
                        activeSubscription?.id
                      );
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ProductPricing;
