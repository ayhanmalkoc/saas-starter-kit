import { Loading } from '@/components/shared';
import { buildTeamWorkspaceAppPath } from '@/lib/routing/workspace-routes';
import useTeams from 'hooks/useTeams';
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import type { NextPageWithLayout } from 'types';

const Dashboard: NextPageWithLayout = () => {
  const router = useRouter();
  const { teams, isLoading } = useTeams();

  useEffect(() => {
    if (isLoading || !teams) {
      return;
    }

    if (teams.length > 0) {
      const settingsPath = buildTeamWorkspaceAppPath({
        team: teams[0],
        suffix: 'settings',
      });

      if (!settingsPath) {
        router.push('/teams?newTeam=true');
        return;
      }

      router.push(settingsPath);
    } else {
      router.push('/teams?newTeam=true');
    }
  }, [isLoading, router, teams]);

  return <Loading />;
};

export async function getStaticProps({ locale }: GetServerSidePropsContext) {
  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
}

export default Dashboard;
