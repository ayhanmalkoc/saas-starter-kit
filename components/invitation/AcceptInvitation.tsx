import toast from 'react-hot-toast';
import { Button } from 'react-daisyui';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';

import type { ApiResponse } from 'types';
import { defaultHeaders } from '@/lib/common';
import { buildTeamWorkspaceApiPath } from '@/lib/routing/workspace-routes';
import type { InvitationWithTeamContext } from '@/hooks/useInvitation';

interface AcceptInvitationProps {
  invitation: InvitationWithTeamContext;
}

const AcceptInvitation = ({ invitation }: AcceptInvitationProps) => {
  const router = useRouter();
  const { t } = useTranslation('common');

  const acceptInvitation = async () => {
    const invitationsUrl = buildTeamWorkspaceApiPath({
      team: invitation.team,
      suffix: 'invitations',
    });

    if (!invitationsUrl) {
      toast.error('Workspace API route could not be resolved.');
      return;
    }

    const response = await fetch(invitationsUrl, {
      method: 'PUT',
      headers: defaultHeaders,
      body: JSON.stringify({ inviteToken: invitation.token }),
    });

    if (!response.ok) {
      const result = (await response.json()) as ApiResponse;
      toast.error(result.error.message);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <>
      <h3 className="text-center">{t('accept-invite')}</h3>
      <Button onClick={acceptInvitation} fullWidth color="primary" size="md">
        {t('accept-invitation')}
      </Button>
    </>
  );
};

export default AcceptInvitation;
