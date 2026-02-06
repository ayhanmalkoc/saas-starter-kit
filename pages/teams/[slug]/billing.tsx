import useSWR from 'swr';
import { useTranslation } from 'next-i18next';
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

import env from '@/lib/env';
import useTeam from 'hooks/useTeam';
import fetcher from '@/lib/fetcher';
import useCanAccess from 'hooks/useCanAccess';
import { TeamTab } from '@/components/team';
import Help from '@/components/billing/Help';
import { Error, Loading } from '@/components/shared';
import LinkToPortal from '@/components/billing/LinkToPortal';
import Subscriptions from '@/components/billing/Subscriptions';
import ProductPricing from '@/components/billing/ProductPricing';

const Payments = ({ teamFeatures }) => {
  const { t } = useTranslation('common');
  const { canAccess } = useCanAccess();
  const { isLoading, isError, team } = useTeam();
  const { data } = useSWR(
    team?.slug ? `/api/teams/${team?.slug}/payments/products` : null,
    fetcher
  );

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return <Error message={isError.message} />;
  }

  if (!team) {
    return <Error message={t('team-not-found')} />;
  }

  const plans = data?.data?.products || [];
  const subscriptions = data?.data?.subscriptions || [];
  const invoices = data?.data?.invoices || [];
  const activeSubscription = subscriptions.find((subscription) =>
    ['active', 'trialing', 'past_due'].includes(subscription.status)
  );

  const formatAmount = (amount: number, currency: string) => {
    const normalizedCurrency = currency.toUpperCase();
    const zeroDecimalCurrencies = new Set([
      'BIF',
      'CLP',
      'DJF',
      'GNF',
      'JPY',
      'KMF',
      'KRW',
      'MGA',
      'PYG',
      'RWF',
      'UGX',
      'VND',
      'VUV',
      'XAF',
      'XOF',
      'XPF',
    ]);
    const divisor = zeroDecimalCurrencies.has(normalizedCurrency) ? 1 : 100;

    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCurrency,
    }).format(amount / divisor);
  };

  return (
    <>
      {canAccess('team_payments', ['read']) && (
        <>
          <TeamTab
            activeTab="payments"
            team={team}
            teamFeatures={teamFeatures}
          />

          <div className="flex gap-6 flex-col md:flex-row">
            <LinkToPortal team={team} />
            <Help />
          </div>

          <div className="py-6">
            <Subscriptions subscriptions={subscriptions} />
          </div>

          <div className="py-6">
            <div className="space-y-3">
              <h2 className="card-title text-xl font-medium leading-none tracking-tight">
                {t('active-subscription')}
              </h2>
              {activeSubscription ? (
                <div className="rounded-lg border p-4 text-sm">
                  <div className="font-medium">
                    {activeSubscription.product?.name || t('plan')}
                  </div>
                  <div className="text-muted-foreground">
                    {t('status')}: {activeSubscription.status}
                  </div>
                  {activeSubscription.currentPeriodEnd && (
                    <div className="text-muted-foreground">
                      {t('end-date')}:{' '}
                      {new Date(
                        activeSubscription.currentPeriodEnd
                      ).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  {t('no-active-subscription')}
                </div>
              )}
            </div>
          </div>

          <div className="py-6">
            <div className="space-y-3">
              <h2 className="card-title text-xl font-medium leading-none tracking-tight">
                {t('invoices')}
              </h2>
              {invoices.length > 0 ? (
                <table className="table w-full text-sm border">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>{t('status')}</th>
                      <th>{t('amount')}</th>
                      <th>{t('due-date')}</th>
                      <th>{t('invoice')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>{invoice.id}</td>
                        <td>{invoice.status}</td>
                        <td>
                          {formatAmount(invoice.amount, invoice.currency)}
                        </td>
                        <td>
                          {invoice.dueDate
                            ? new Date(invoice.dueDate).toLocaleDateString()
                            : t('not-applicable')}
                        </td>
                        <td>
                          {invoice.hostedInvoiceUrl ? (
                            <a
                              className="link"
                              href={invoice.hostedInvoiceUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {t('view')}
                            </a>
                          ) : (
                            t('not-applicable')
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  {t('no-invoices')}
                </div>
              )}
            </div>
          </div>

          <ProductPricing plans={plans} subscriptions={subscriptions} />
        </>
      )}
    </>
  );
};

export async function getServerSideProps({
  locale,
}: GetServerSidePropsContext) {
  if (!env.teamFeatures.payments) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
      teamFeatures: env.teamFeatures,
    },
  };
}

export default Payments;
