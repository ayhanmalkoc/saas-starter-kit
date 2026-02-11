import { GetServerSidePropsContext } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import type { NextPageWithLayout } from 'types';
import { ReactElement } from 'react';
import PricingTable from '@/components/billing/PricingTable';
import FAQSection from '@/components/defaultLanding/FAQSection';
import { getAllServices } from 'models/service';
import Navbar from '@/components/defaultLanding/Navbar';
import Footer from '@/components/defaultLanding/Footer';
import Head from 'next/head';

interface PricingProps {
  plans: any[];
}

const Pricing: NextPageWithLayout<PricingProps> = ({ plans }) => {
  const { t } = useTranslation('common');

  return (
    <>
      <Head>
        <title>{t('pricing-title')}</title>
      </Head>
      <Navbar />
      <div className="container mx-auto py-12 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t('pricing-title')}</h1>
          <p className="text-xl text-gray-600">{t('pricing-subtitle')}</p>
        </div>

        <PricingTable plans={plans} />

        <div className="divider my-12"></div>
        <FAQSection />
      </div>
      <Footer />
    </>
  );
};

Pricing.getLayout = function getLayout(page: ReactElement) {
  return <>{page}</>;
};

export const getServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const { locale } = context;

  const plans = await getAllServices();

  // Filter out archived products (if not already handled by getAllServices)
  // getAllServices handles basic tier filtering now.

  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
      plans: JSON.parse(JSON.stringify(plans)), // Serialize dates
    },
  };
};

export default Pricing;
