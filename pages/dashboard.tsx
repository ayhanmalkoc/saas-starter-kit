import { Loading } from '@/components/shared';
import { buildProjectWorkspaceAppPath } from '@/lib/routing/workspace-routes';
import useProjects from 'hooks/useProjects';
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import type { NextPageWithLayout } from 'types';

const Dashboard: NextPageWithLayout = () => {
  const router = useRouter();
  const { projects, isLoading } = useProjects();

  useEffect(() => {
    if (isLoading || !projects) {
      return;
    }

    if (projects.length > 0) {
      const settingsPath = buildProjectWorkspaceAppPath({
        project: projects[0],
        suffix: 'settings',
      });

      if (!settingsPath) {
        router.push('/orgs?newProject=true');
        return;
      }

      router.push(settingsPath);
    } else {
      router.push('/orgs?newProject=true');
    }
  }, [isLoading, router, projects]);

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
