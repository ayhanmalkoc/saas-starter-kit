import APIKeysContainer from '@/components/apiKey/APIKeysContainer';
import { getLegacyTeamRouteRedirect } from '@/lib/routing/legacy-team-redirect';
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import env from '@/lib/env';

const APIKeys = ({ teamFeatures }) => {
  return <APIKeysContainer teamFeatures={teamFeatures} />;
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const redirect = await getLegacyTeamRouteRedirect(context);
  if (redirect) {
    return redirect;
  }

  const { locale } = context;

  if (!env.teamFeatures.apiKey) {
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

export default APIKeys;
