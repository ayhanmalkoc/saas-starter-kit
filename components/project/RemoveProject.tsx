import { Card } from '@/components/shared';
import type { Project } from '@prisma/client';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import { Button } from 'react-daisyui';
import toast from 'react-hot-toast';

import ConfirmationDialog from '../shared/ConfirmationDialog';
import { defaultHeaders } from '@/lib/common';
import {
  buildProjectWorkspaceApiPath,
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import type { ApiResponse } from 'types';

interface RemoveProjectProps {
  project: Project;
  allowDelete: boolean;
}

const RemoveProject = ({ project, allowDelete }: RemoveProjectProps) => {
  const router = useRouter();
  const { t } = useTranslation('common');
  const [loading, setLoading] = useState(false);
  const [askConfirmation, setAskConfirmation] = useState(false);
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);

  const removeProject = async () => {
    setLoading(true);

    const removeProjectUrl =
      buildWorkspaceApiPath({
        context: routeContext,
      }) ?? buildProjectWorkspaceApiPath({ project: project });

    if (!removeProjectUrl) {
      setLoading(false);
      toast.error('Workspace API route could not be resolved.');
      return;
    }

    const response = await fetch(removeProjectUrl, {
      method: 'DELETE',
      headers: defaultHeaders,
    });

    setLoading(false);

    if (!response.ok) {
      const json = (await response.json()) as ApiResponse;
      toast.error(json.error.message);
      return;
    }

    toast.success(t('project-removed-successfully'));
    router.push('/orgs');
  };

  return (
    <>
      <Card>
        <Card.Body>
          <Card.Header>
            <Card.Title>{t('remove-project')}</Card.Title>
            <Card.Description>
              {allowDelete
                ? t('remove-project-warning')
                : t('remove-project-restricted')}
            </Card.Description>
          </Card.Header>
        </Card.Body>
        {allowDelete && (
          <Card.Footer>
            <Button
              color="error"
              onClick={() => setAskConfirmation(true)}
              loading={loading}
              variant="outline"
              size="md"
            >
              {t('remove-project')}
            </Button>
          </Card.Footer>
        )}
      </Card>
      {allowDelete && (
        <ConfirmationDialog
          visible={askConfirmation}
          title={t('remove-project')}
          onCancel={() => setAskConfirmation(false)}
          onConfirm={removeProject}
        >
          {t('remove-project-confirmation')}
        </ConfirmationDialog>
      )}
    </>
  );
};

export default RemoveProject;
