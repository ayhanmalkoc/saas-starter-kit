import { Error, Loading } from '@/components/shared';
import { ProjectTab } from '@/components/project';
import useProject from 'hooks/useProject';
import { useTranslation } from 'next-i18next';
import APIKeys from './APIKeys';
import { WorkspaceFeature } from 'types';

const APIKeysContainer = ({
  workspaceFeatures,
}: {
  workspaceFeatures: WorkspaceFeature;
}) => {
  const { t } = useTranslation('common');

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

  return (
    <>
      <ProjectTab
        activeTab="api-keys"
        project={project}
        workspaceFeatures={workspaceFeatures}
      />
      <APIKeys project={project} />
    </>
  );
};

export default APIKeysContainer;
