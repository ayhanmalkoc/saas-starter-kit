import { useState, useEffect } from 'react';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import toast from 'react-hot-toast';
import { Button } from 'react-daisyui';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import useTeam from 'hooks/useTeam';
import useTeams from 'hooks/useTeams';
import { Price, Prisma, Service, Subscription } from '@prisma/client';
import PaymentButton from './PaymentButton';
import { handlePlanChange } from './planService';

interface PricingTableProps {
  plans: (Service & { prices: Price[] })[];
  currentSubscription?: Subscription & { product: Service };
}

const PricingTable = ({
  plans,
  currentSubscription: initialSubscription,
}: PricingTableProps) => {
  const router = useRouter();
  const { team: teamFromSlug } = useTeam();
  const { teams } = useTeams();

  // Create a fallback to the first team if we don't have a team from the slug (e.g. on /pricing public page)
  const team = teamFromSlug || (teams && teams.length > 0 ? teams[0] : null);

  const { data, isLoading: isBillingLoading } = useSWR(
    team?.slug ? `/api/teams/${team?.slug}/payments/products` : null,
    fetcher
  );

  const subscriptions = data?.data?.subscriptions || [];
  const activeSubscription =
    !isBillingLoading && subscriptions
      ? subscriptions.find((subscription: any) =>
          ['active', 'trialing', 'past_due', 'incomplete'].includes(
            subscription.status
          )
        )
      : initialSubscription; // Fallback to prop if SWR not ready or used

  const currentSubscription = activeSubscription;

  const { t } = useTranslation('common');
  const salesEmail =
    process.env.NEXT_PUBLIC_SALES_EMAIL?.trim() || 'sales@example.com';
  const isTeamContext = Boolean(team?.slug);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>(
    'month'
  );
  const [tier, setTier] = useState<'individual' | 'business'>('individual');

  useEffect(() => {
    if (isTeamContext && tier !== 'business') {
      setTier('business');
    }
  }, [isTeamContext, tier]);

  // Auto-trigger checkout if plan param exists and user is logged in (has team)
  useEffect(() => {
    if (router.isReady && router.query.plan && team?.slug) {
      const planId = router.query.plan as string;
      // Prevent infinite loop if plan ID is invalid or user cancels
      // But initiatePlanChange handles the flow.
      // We might want to remove the query param after triggering to avoid loop on refresh?
      // For now, let's just trigger.

      // We need to find if this plan exists in our list to know if it requires quantity?
      // initiatePlanChange handles null quantity gracefully for per_unit?
      // Let's find the price in 'plans' prop to be safe.
      const selectedPrice = plans
        .flatMap((p) => p.prices)
        .find((p) => p.id === planId);

      if (selectedPrice) {
        initiatePlanChange(
          planId,
          isSeatBasedPrice(selectedPrice)
            ? (currentSubscription?.quantity ?? 1)
            : undefined,
          currentSubscription?.id
        );
        const rest = { ...router.query };
        delete rest.plan;
        router.replace({ query: rest }, undefined, { shallow: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.plan, team?.slug]);

  const initiatePlanChange = async (
    priceId: string,
    quantity?: number,
    subscriptionId?: string | null
  ) => {
    if (!team?.slug) {
      // If no team, redirect to join or login
      router.push(
        `/auth/join?callbackUrl=${encodeURIComponent(
          `/pricing?plan=${priceId}`
        )}`
      );
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
      // Optional: Refresh data
      return;
    }

    toast.error(
      data?.error?.message ||
        data?.error?.raw?.message ||
        t('stripe-checkout-fallback-error')
    );
  };

  const isCurrentPlan = (price: Price) => {
    if (currentSubscription?.priceId === price.id) {
      return true;
    }

    // If user is logged in (has team) and has NO active paid subscription,
    // and the price amount is 0, this is their current (Free) plan.
    if (
      team?.slug &&
      !currentSubscription &&
      (price.amount === 0 ||
        price.amount === null ||
        price.amount === undefined)
    ) {
      return true;
    }

    return false;
  };

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

  const filteredPlans = plans
    .filter((plan) => {
      const metadata = plan.metadata as { tier?: string };
      const planTier = metadata?.tier || 'personal'; // Default to personal if missing
      if (isTeamContext) {
        return planTier === 'business';
      }
      // Map 'personal' from DB to 'individual' for UI logic if needed, or just check against 'personal'
      // DB has 'personal' and 'business' tiers.
      if (tier === 'individual') {
        return planTier === 'personal' || planTier === 'free';
      }
      return planTier === tier;
    })
    .sort((a, b) => {
      const metadataA = a.metadata as { planLevel?: number | string };
      const metadataB = b.metadata as { planLevel?: number | string };
      const parsedLevelA = Number(metadataA?.planLevel);
      const parsedLevelB = Number(metadataB?.planLevel);
      const levelA = Number.isFinite(parsedLevelA)
        ? parsedLevelA
        : Number.MAX_SAFE_INTEGER;
      const levelB = Number.isFinite(parsedLevelB)
        ? parsedLevelB
        : Number.MAX_SAFE_INTEGER;

      if (levelA !== levelB) {
        return levelA - levelB;
      }

      return a.name.localeCompare(b.name);
    });

  const containerMaxWidth =
    !isTeamContext && tier === 'individual' ? 'max-w-7xl' : 'max-w-4xl';
  // Individual: 3 columns (Free, Basic, Pro)
  // Business: 2 columns (Team, Enterprise)
  const gridCols =
    !isTeamContext && tier === 'individual'
      ? 'grid-cols-1 md:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2';

  return (
    <section className={`py-3 mx-auto ${containerMaxWidth} px-4`}>
      <div className="flex flex-col items-center justify-center mb-8 space-y-6">
        {/* Tier Tabs */}
        <div className="tabs tabs-boxed p-1 bg-gray-100 rounded-full w-fit mx-auto">
          {!isTeamContext && (
            <button
              className={`tab tab-lg px-8 transition-all duration-200 ${tier === 'individual' ? 'tab-active !bg-primary !text-white !rounded-full shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setTier('individual')}
            >
              {t('individual') || 'Individual'}
            </button>
          )}
          <button
            className={`tab tab-lg px-8 transition-all duration-200 ${tier === 'business' ? 'tab-active !bg-primary !text-white !rounded-full shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setTier('business')}
          >
            {t('business')}
          </button>
        </div>

        {/* Billing Interval Toggle */}
        <div className="flex items-center space-x-4 bg-gray-50 p-2 rounded-lg border">
          <button
            type="button"
            className={`cursor-pointer text-sm font-medium ${billingInterval === 'month' ? 'text-black' : 'text-gray-500'}`}
            onClick={() => setBillingInterval('month')}
          >
            {t('monthly')}
          </button>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            aria-label={t('billing-interval')}
            checked={billingInterval === 'year'}
            onChange={() =>
              setBillingInterval((prev) =>
                prev === 'month' ? 'year' : 'month'
              )
            }
          />
          <button
            type="button"
            className={`cursor-pointer text-sm font-medium ${billingInterval === 'year' ? 'text-black' : 'text-gray-500'}`}
            onClick={() => setBillingInterval('year')}
          >
            {t('yearly')}{' '}
            <span className="badge badge-sm badge-accent ml-1">
              {t('save-20')}
            </span>
          </button>
        </div>
      </div>

      <div className={`grid gap-6 ${gridCols}`}>
        {filteredPlans.map((plan) => {
          // Find price for the selected interval
          let price = plan.prices.find((p: Price) => {
            const recurring =
              (p.metadata as any)?.recurring || (p as any).recurring;
            return recurring?.interval === billingInterval;
          });

          // Fallback: If no price for interval, but plan is Free/Custom, use first available price
          // This ensures Free/Enterprise plans show up even if they don't have explicit Yearly prices
          const metadata = plan.metadata as {
            recommended?: boolean | string;
            custom?: string | boolean;
          };

          if (!price) {
            const defaultPrice = plan.prices[0];
            if (
              defaultPrice?.amount === 0 ||
              metadata?.custom === 'true' ||
              metadata?.custom === true
            ) {
              price = defaultPrice;
            }
          }

          if (!price) return null;

          const isRecommended =
            metadata?.recommended === 'true' || metadata?.recommended === true;

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
                  {(metadata as any)?.custom === true ||
                  (metadata as any)?.custom === 'true' ? (
                    <span className="text-3xl font-bold tracking-tight text-gray-900">
                      {t('contact-us')}
                    </span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold tracking-tight text-gray-900">
                        {new Intl.NumberFormat(router.locale, {
                          style: 'currency',
                          currency: price.currency,
                          minimumFractionDigits: 2,
                        }).format(price.amount || 0)}
                      </span>
                      <span className="ml-1 text-sm font-semibold text-gray-500">
                        /{billingInterval}{' '}
                        {tier === 'business' ? t('per-user') : ''}
                      </span>
                    </>
                  )}
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
                {(metadata as any)?.custom === true ||
                (metadata as any)?.custom === 'true' ? (
                  <Button
                    variant="outline"
                    fullWidth
                    className="rounded-xl"
                    onClick={() =>
                      (window.location.href = `mailto:${salesEmail}`)
                    }
                  >
                    {t('contact-sales') || 'Contact Sales'}
                  </Button>
                ) : isCurrentPlan(price) ? (
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
                        isSeatBasedPrice(price as Price)
                          ? (currentSubscription?.quantity ?? quantity ?? 1)
                          : undefined,
                        currentSubscription?.id
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

export default PricingTable;
