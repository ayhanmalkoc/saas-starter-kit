import { Error, Loading } from '@/components/shared';
import { TeamTab } from '@/components/team';
import { Webhooks } from '@/components/webhook';
import useTeam from 'hooks/useTeam';
import { useTranslation } from 'next-i18next';

const WebhookList = ({ teamFeatures }) => {
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
      <TeamTab activeTab="webhooks" team={team} teamFeatures={teamFeatures} />
      <Webhooks team={team} />
    </>
  );
};


export default WebhookList;




