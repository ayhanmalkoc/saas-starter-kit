import { Error, Loading } from '@/components/shared';
import { ProjectTab } from '@/components/project';
import { ConnectionsWrapper } from '@boxyhq/react-ui/sso';
import useProject from 'hooks/useProject';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { BOXYHQ_UI_CSS } from '@/components/styles';
import {
  buildProjectWorkspaceApiPath,
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';

const TeamSSO = ({ workspaceFeatures, SPConfigURL }) => {
  const { t } = useTranslation('common');
  const router = useRouter();

  const { isLoading, isError, project } = useProject();

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return <Error message={isError.message} />;
  }

  if (!project) {
    return <Error message={t('project-not-found')} />;
  }

  const routeContext = getWorkspaceRouteContextFromQuery(router.query);
  const ssoUrl =
    buildWorkspaceApiPath({
      context: routeContext,
      suffix: 'sso',
    }) ?? buildProjectWorkspaceApiPath({ project, suffix: 'sso' });

  if (!ssoUrl) {
    return <Error message={t('project-not-found')} />;
  }

  return (
    <>
      <ProjectTab
        activeTab="sso"
        project={project}
        workspaceFeatures={workspaceFeatures}
      />
      <ConnectionsWrapper
        urls={{
          spMetadata: SPConfigURL,
          get: ssoUrl,
          post: ssoUrl,
          patch: ssoUrl,
          delete: ssoUrl,
        }}
        successCallback={({
          operation,
          connectionIsSAML,
          connectionIsOIDC,
        }) => {
          const ssoType = connectionIsSAML
            ? 'SAML'
            : connectionIsOIDC
              ? 'OIDC'
              : '';
          if (operation === 'CREATE') {
            toast.success(`${ssoType} connection created successfully.`);
          } else if (operation === 'UPDATE') {
            toast.success(`${ssoType} connection updated successfully.`);
          } else if (operation === 'DELETE') {
            toast.success(`${ssoType} connection deleted successfully.`);
          } else if (operation === 'COPY') {
            toast.success(`Contents copied to clipboard`);
          }
        }}
        errorCallback={(errMessage) => toast.error(errMessage)}
        classNames={BOXYHQ_UI_CSS}
        componentProps={{
          connectionList: {
            cols: ['provider', 'type', 'status', 'actions'],
          },
          editOIDCConnection: { displayInfo: false },
          editSAMLConnection: { displayInfo: false },
        }}
      />
    </>
  );
};

export default TeamSSO;
