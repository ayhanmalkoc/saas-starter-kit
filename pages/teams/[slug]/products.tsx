import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import type { NextPageWithLayout } from 'types';
import { useTranslation } from 'next-i18next';
import { getLegacyTeamRouteRedirect } from '@/lib/routing/legacy-team-redirect';

const Products: NextPageWithLayout = () => {
  const { t } = useTranslation('common');

  return (
    <div className="p-3">
      <p className="text-sm">{t('product-placeholder')}</p>
    </div>
  );
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const redirect = await getLegacyTeamRouteRedirect(context);
  if (redirect) {
    return redirect;
  }

  const { locale } = context;

  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
}

export default Products;
