import { Card } from '@/components/shared';
import { Error, Loading } from '@/components/shared';
import { TeamTab } from '@/components/team';
import useCanAccess from 'hooks/useCanAccess';
import useTeam from 'hooks/useTeam';
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
  teamFeatures: any;
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
  teamFeatures,
}) => {
  const { t } = useTranslation('common');
  const { canAccess } = useCanAccess();
  const { isLoading, isError, team } = useTeam();

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return <Error message={isError.message} />;
  }

  if (!team) {
    return <Error message={t('team-not-found')} />;
  }

  return (
    <>
      <TeamTab activeTab="audit-logs" team={team} teamFeatures={teamFeatures} />
      <Card>
        <Card.Body>
          {error ? (
            <Error message={error.message} />
          ) : (
            canAccess('team_audit_log', ['read']) &&
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




