import { Error, Loading } from '@/components/shared';
import { AccessControl } from '@/components/shared/AccessControl';
import {
  ProjectSettings,
  ProjectTab,
  RemoveProject,
} from '@/components/project';
import useProject from 'hooks/useProject';
import { useTranslation } from 'next-i18next';
import type { WorkspaceFeature } from 'types';

const Settings = ({
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
        activeTab="settings"
        project={project}
        workspaceFeatures={workspaceFeatures}
      />
      <div className="space-y-6">
        <ProjectSettings project={project} />
        <AccessControl resource="project" actions={['delete']}>
          <RemoveProject
            project={project}
            allowDelete={workspaceFeatures.deleteProject}
          />
        </AccessControl>
      </div>
    </>
  );
};

export default Settings;
