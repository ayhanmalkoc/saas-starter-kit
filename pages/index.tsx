import { type ReactElement } from 'react';
import { useTranslation } from 'next-i18next';
import type { NextPageWithLayout } from 'types';
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import FAQSection from '@/components/defaultLanding/FAQSection';
import HeroSection from '@/components/defaultLanding/HeroSection';
import FeatureSection from '@/components/defaultLanding/FeatureSection';
import PricingTable from '@/components/billing/PricingTable';
import Navbar from '@/components/defaultLanding/Navbar';
import env from '@/lib/env';
import Head from 'next/head';
import { getAllServices } from 'models/service';

const Home: NextPageWithLayout = ({ products }: any) => {
  const { t } = useTranslation('common');

  return (
    <>
      <Head>
        <title>{t('homepage-title')}</title>
      </Head>

      <div className="container mx-auto">
        <Navbar />

        <HeroSection />
        <div className="divider"></div>
        <FeatureSection />
        <div className="divider"></div>
        <section className="py-6">
          <div className="flex flex-col justify-center space-y-6">
            <h2 className="text-center text-4xl font-bold normal-case">
              {t('pricing')}
            </h2>
            <PricingTable plans={products} />
          </div>
        </section>
        <div className="divider"></div>
        <FAQSection />
      </div>
    </>
  );
};

export const getServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  // Redirect to login page if landing page is disabled
  if (env.hideLandingPage) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: true,
      },
    };
  }

  const { locale } = context;
  const products = await getAllServices();

  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
      products: JSON.parse(JSON.stringify(products)),
    },
  };
};

Home.getLayout = function getLayout(page: ReactElement) {
  return <>{page}</>;
};

export default Home;
