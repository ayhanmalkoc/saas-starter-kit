import { Error, Loading } from '@/components/shared';
import { TeamTab } from '@/components/team';
import useTeam from 'hooks/useTeam';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { DirectoriesWrapper } from '@boxyhq/react-ui/dsync';
import { BOXYHQ_UI_CSS } from '@/components/styles';
import {
  buildTeamWorkspaceApiPath,
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';

const DirectorySync = ({ teamFeatures }) => {
  const router = useRouter();
  const { isLoading, isError, team } = useTeam();
  const { t } = useTranslation('common');

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return <Error message={isError.message} />;
  }

  if (!team) {
    return <Error message={t('team-not-found')} />;
  }

  const routeContext = getWorkspaceRouteContextFromQuery(router.query);
  const directorySyncUrl =
    buildWorkspaceApiPath({
      context: routeContext,
      teamSlug: team.slug,
      suffix: 'dsync',
    }) ?? buildTeamWorkspaceApiPath({ team, suffix: 'dsync' });

  if (!directorySyncUrl) {
    return <Error message={t('team-not-found')} />;
  }

  return (
    <>
      <TeamTab
        activeTab="directory-sync"
        team={team}
        teamFeatures={teamFeatures}
      />
      <DirectoriesWrapper
        classNames={BOXYHQ_UI_CSS}
        componentProps={{
          directoryList: {
            cols: ['name', 'type', 'status', 'actions'],
            hideViewAction: true,
          },
          createDirectory: {
            excludeFields: [
              'product',
              'tenant',
              'webhook_secret',
              'webhook_url',
              'log_webhook_events',
            ],
            disableGoogleProvider: true,
          },
          editDirectory: {
            excludeFields: [
              'webhook_url',
              'webhook_secret',
              'log_webhook_events',
            ],
          },
        }}
        urls={{
          get: directorySyncUrl,
          post: directorySyncUrl,
          patch: directorySyncUrl,
          delete: directorySyncUrl,
        }}
        successCallback={({ operation }) => {
          if (operation === 'CREATE') {
            toast.success(`Connection created successfully.`);
          } else if (operation === 'UPDATE') {
            toast.success(`Connection updated successfully.`);
          } else if (operation === 'DELETE') {
            toast.success(`Connection deleted successfully.`);
          } else if (operation === 'COPY') {
            toast.success(`Contents copied to clipboard`);
          }
        }}
        errorCallback={(errMessage) => toast.error(errMessage)}
      />
    </>
  );
};


export default DirectorySync;




