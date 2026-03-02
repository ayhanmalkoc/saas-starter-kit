import { Error, Loading } from '@/components/shared';
import type { Project } from '@prisma/client';
import type { FormikHelpers } from 'formik';
import useWebhook from 'hooks/useWebhook';
import useWebhooks from 'hooks/useWebhooks';
import { useTranslation } from 'next-i18next';
import React from 'react';
import toast from 'react-hot-toast';
import type { EndpointOut } from 'svix';
import type { WebhookFormSchema } from 'types';
import type { ApiResponse } from 'types';

import ModalForm from './Form';
import { defaultHeaders } from '@/lib/common';
import {
  buildProjectWorkspaceApiPath,
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import { useRouter } from 'next/router';

const EditWebhook = ({
  visible,
  setVisible,
  project,
  endpoint,
}: {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  project: Project;
  endpoint: EndpointOut;
}) => {
  const router = useRouter();
  const { isLoading, isError, webhook } = useWebhook(endpoint.id);
  const { t } = useTranslation('common');
  const { mutateWebhooks } = useWebhooks();
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);

  if (isLoading || !webhook) {
    return <Loading />;
  }

  if (isError) {
    return <Error message={isError.message} />;
  }

  const onSubmit = async (
    values: WebhookFormSchema,
    formikHelpers: FormikHelpers<WebhookFormSchema>
  ) => {
    const webhookUrl =
      buildWorkspaceApiPath({
        context: routeContext,
        suffix: `webhooks/${endpoint.id}`,
      }) ??
      buildProjectWorkspaceApiPath({
        project: project,
        suffix: `webhooks/${endpoint.id}`,
      });

    if (!webhookUrl) {
      toast.error('Workspace API route could not be resolved.');
      return;
    }

    const response = await fetch(webhookUrl, {
      method: 'PUT',
      headers: defaultHeaders,
      body: JSON.stringify(values),
    });

    const json = (await response.json()) as ApiResponse;

    if (!response.ok) {
      toast.error(json.error.message);
      return;
    }

    toast.success(t('webhook-updated'));
    mutateWebhooks();
    setVisible(false);
    formikHelpers.resetForm();
  };

  return (
    <ModalForm
      visible={visible}
      setVisible={setVisible}
      initialValues={{
        name: webhook.description as string,
        url: webhook.url,
        eventTypes: webhook.filterTypes as string[],
      }}
      onSubmit={onSubmit}
      title={t('edit-webhook-endpoint')}
      editMode={true}
    />
  );
};

export default EditWebhook;
