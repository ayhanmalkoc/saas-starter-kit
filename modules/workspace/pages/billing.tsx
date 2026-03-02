import useSWR from 'swr';
import { useTranslation } from 'next-i18next';
import { Button } from 'react-daisyui';

import useProject from 'hooks/useProject';
import fetcher from '@/lib/fetcher';
import useCanAccess from 'hooks/useCanAccess';
import { ProjectTab } from '@/components/project';
import Help from '@/components/billing/Help';
import { Error, Loading } from '@/components/shared';
import LinkToPortal from '@/components/billing/LinkToPortal';
import Subscriptions from '@/components/billing/Subscriptions';
import {
  buildProjectWorkspaceApiPath,
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import { useRouter } from 'next/router';

const LinkToPricing = () => {
  const { t } = useTranslation('common');
  return (
    <Button
      color="primary"
      size="sm"
      variant="outline"
      onClick={() => (window.location.href = '/pricing')}
    >
      {t('change-plan')}
    </Button>
  );
};

const Payments = ({ workspaceFeatures }) => {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { canAccess } = useCanAccess();
  const { isLoading, isError, project } = useProject();
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);
  const billingProductsUrl = project?.slug
    ? (buildWorkspaceApiPath({
        context: routeContext,
        suffix: 'payments/products',
      }) ??
      buildProjectWorkspaceApiPath({
        project,
        suffix: 'payments/products',
      }))
    : null;

  const { data, isLoading: isBillingLoading } = useSWR(
    billingProductsUrl,
    fetcher
  );

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return <Error message={isError.message} />;
  }

  if (!project) {
    return <Error message={t('project-not-found')} />;
  }

  const isBillingDataLoading = isBillingLoading || data === undefined;
  // const plans = data?.data?.products || [];
  const subscriptions = data?.data?.subscriptions || [];
  const invoices = data?.data?.invoices || [];
  const activeSubscription = !isBillingDataLoading
    ? subscriptions.find((subscription) =>
        ['active', 'trialing', 'past_due'].includes(subscription.status)
      )
    : null;

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
      {canAccess('project_payments', ['read']) && (
        <>
          <ProjectTab
            activeTab="payments"
            project={project}
            workspaceFeatures={workspaceFeatures}
          />

          <div className="flex gap-6 flex-col md:flex-row">
            <LinkToPortal project={project} />
            <Help />
          </div>

          {isBillingDataLoading ? (
            <div className="py-6">
              <Loading />
            </div>
          ) : (
            <>
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
                      <div className="font-medium text-black">
                        {t('current-plan')}: {t('free-plan')}
                      </div>
                      <div className="mt-2">
                        <LinkToPricing />
                      </div>
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
            </>
          )}
        </>
      )}
    </>
  );
};

export default Payments;
