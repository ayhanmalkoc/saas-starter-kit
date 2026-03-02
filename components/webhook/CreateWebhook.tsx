import type { Project } from '@prisma/client';
import type { FormikHelpers } from 'formik';
import useWebhooks from 'hooks/useWebhooks';
import { useTranslation } from 'next-i18next';
import React from 'react';
import toast from 'react-hot-toast';
import type { ApiResponse } from 'types';
import type { WebhookFormSchema } from 'types';

import ModalForm from './Form';
import { defaultHeaders } from '@/lib/common';
import {
  buildProjectWorkspaceApiPath,
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import { useRouter } from 'next/router';

const CreateWebhook = ({
  visible,
  setVisible,
  project,
}: {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  project: Project;
}) => {
  const router = useRouter();
  const { mutateWebhooks } = useWebhooks();
  const { t } = useTranslation('common');
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);

  const onSubmit = async (
    values: WebhookFormSchema,
    formikHelpers: FormikHelpers<WebhookFormSchema>
  ) => {
    const webhooksUrl =
      buildWorkspaceApiPath({
        context: routeContext,
        suffix: 'webhooks',
      }) ??
      buildProjectWorkspaceApiPath({ project: project, suffix: 'webhooks' });

    if (!webhooksUrl) {
      toast.error('Workspace API route could not be resolved.');
      return;
    }

    const response = await fetch(webhooksUrl, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify(values),
    });

    const json = (await response.json()) as ApiResponse<Project>;

    if (!response.ok) {
      toast.error(json.error.message);
      return;
    }

    toast.success(t('webhook-created'));
    mutateWebhooks();
    setVisible(false);
    formikHelpers.resetForm();
  };

  return (
    <ModalForm
      visible={visible}
      setVisible={setVisible}
      initialValues={{
        name: '',
        url: '',
        eventTypes: [],
      }}
      onSubmit={onSubmit}
      title={t('create-webhook')}
    />
  );
};

export default CreateWebhook;
