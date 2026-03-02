import { PendingInvitations } from '@/components/invitation';
import { Error, Loading } from '@/components/shared';
import { ProjectMembers, ProjectTab } from '@/components/project';
import useProject from 'hooks/useProject';
import { useTranslation } from 'next-i18next';

const TeamMembers = ({ workspaceFeatures }) => {
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
        activeTab="members"
        project={project}
        workspaceFeatures={workspaceFeatures}
      />
      <div className="space-y-6">
        <ProjectMembers project={project} />
        <PendingInvitations project={project} />
      </div>
    </>
  );
};

export default TeamMembers;
