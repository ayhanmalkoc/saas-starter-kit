import { Card } from '@/components/shared';
import { Error, Loading } from '@/components/shared';
import { ProjectTab } from '@/components/project';
import useCanAccess from 'hooks/useCanAccess';
import useProject from 'hooks/useProject';
import { useTranslation } from 'next-i18next';
import dynamic from 'next/dynamic';
import type { NextPageWithLayout } from 'types';

interface RetracedEventsBrowserProps {
  host: string;
  auditLogToken: string;
  header: string;
}

type AuditLogsPageProps = {
  auditLogToken: string | null;
  retracedHost: string | null;
  error: { message: string } | null;
  workspaceFeatures: any;
};

const RetracedEventsBrowser = dynamic<RetracedEventsBrowserProps>(
  () => import('@retracedhq/logs-viewer'),
  {
    ssr: false,
  }
);

const Events: NextPageWithLayout<AuditLogsPageProps> = ({
  auditLogToken,
  retracedHost,
  error,
  workspaceFeatures,
}) => {
  const { t } = useTranslation('common');
  const { canAccess } = useCanAccess();
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
        activeTab="audit-logs"
        project={project}
        workspaceFeatures={workspaceFeatures}
      />
      <Card>
        <Card.Body>
          {error ? (
            <Error message={error.message} />
          ) : (
            canAccess('project_audit_log', ['read']) &&
            auditLogToken && (
              <RetracedEventsBrowser
                host={`${retracedHost}/viewer/v1`}
                auditLogToken={auditLogToken}
                header={t('audit-logs')}
              />
            )
          )}
        </Card.Body>
      </Card>
    </>
  );
};

export default Events;
