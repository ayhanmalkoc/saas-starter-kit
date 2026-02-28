import toast from 'react-hot-toast';
import { Button } from 'react-daisyui';
import { useState } from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';

import { Card } from '@/components/shared';
import { Team } from '@prisma/client';
import { defaultHeaders } from '@/lib/common';
import {
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import { useRouter } from 'next/router';
import type { ApiResponse } from 'types';

interface LinkToPortalProps {
  team: Team;
}

const LinkToPortal = ({ team }: LinkToPortalProps) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation('common');
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);

  const openStripePortal = async () => {
    setLoading(true);

    const portalUrl =
      buildWorkspaceApiPath({
        context: routeContext,
        teamSlug: team.slug,
        suffix: 'payments/create-portal-link',
      }) ?? `/api/teams/${team.slug}/payments/create-portal-link`;

    const response = await fetch(portalUrl, {
      method: 'POST',
      headers: defaultHeaders,
      credentials: 'same-origin',
    });

    const result = (await response.json()) as ApiResponse<{ url: string }>;

    if (!response.ok) {
      toast.error(result.error.message);
      return;
    }

    setLoading(false);
    window.open(result.data.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card>
      <Card.Body>
        <Card.Header>
          <Card.Title>{t('manage-subscription')}</Card.Title>
          <Card.Description>{t('manage-billing-information')}</Card.Description>
        </Card.Header>
        <div>
          <Button
            type="button"
            color="primary"
            size="sm"
            variant="outline"
            loading={loading}
            onClick={() => openStripePortal()}
          >
            {t('billing-portal')}
            <ArrowTopRightOnSquareIcon className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default LinkToPortal;
