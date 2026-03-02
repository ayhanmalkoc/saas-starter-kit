import { Error, Loading } from '@/components/shared';
import { ProjectTab } from '@/components/project';
import { Webhooks } from '@/components/webhook';
import useProject from 'hooks/useProject';
import { useTranslation } from 'next-i18next';

const WebhookList = ({ workspaceFeatures }) => {
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
        activeTab="webhooks"
        project={project}
        workspaceFeatures={workspaceFeatures}
      />
      <Webhooks project={project} />
    </>
  );
};

export default WebhookList;
