import { Error, Loading } from '@/components/shared';
import { AccessControl } from '@/components/shared/AccessControl';
import { RemoveTeam, TeamSettings, TeamTab } from '@/components/team';
import useTeam from 'hooks/useTeam';
import { useTranslation } from 'next-i18next';
import type { TeamFeature } from 'types';

const Settings = ({ teamFeatures }: { teamFeatures: TeamFeature }) => {
  const { t } = useTranslation('common');
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
      <TeamTab activeTab="settings" team={team} teamFeatures={teamFeatures} />
      <div className="space-y-6">
        <TeamSettings team={team} />
        <AccessControl resource="team" actions={['delete']}>
          <RemoveTeam team={team} allowDelete={teamFeatures.deleteTeam} />
        </AccessControl>
      </div>
    </>
  );
};


export default Settings;




