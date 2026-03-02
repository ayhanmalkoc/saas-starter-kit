import { defaultHeaders, maxLengthPolicies } from '@/lib/common';
import type { Prisma } from '@prisma/client';
import { buildProjectWorkspaceAppPath } from '@/lib/routing/workspace-routes';
import { useFormik } from 'formik';
import useProjects from 'hooks/useProjects';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import React from 'react';
import { Button } from 'react-daisyui';
import toast from 'react-hot-toast';
import type { ApiResponse } from 'types';
import * as Yup from 'yup';
import Modal from '../shared/Modal';
import { InputWithLabel } from '../shared';

interface CreateProjectProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

type CreatedProjectPayload = Prisma.ProjectGetPayload<{
  include: {
    organization: {
      select: {
        slug: true;
      };
    };
  };
}>;

const CreateProject = ({ visible, setVisible }: CreateProjectProps) => {
  const { t } = useTranslation('common');
  const { mutateProjects } = useProjects();
  const router = useRouter();

  const formik = useFormik({
    initialValues: {
      name: '',
    },
    validationSchema: Yup.object().shape({
      name: Yup.string().required().max(maxLengthPolicies.project),
    }),
    onSubmit: async (values) => {
      const response = await fetch('/api/orgs', {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify(values),
      });

      const json =
        (await response.json()) as ApiResponse<CreatedProjectPayload>;

      if (!response.ok) {
        toast.error(json.error.message);
        return;
      }

      formik.resetForm();
      mutateProjects();
      setVisible(false);
      toast.success(t('project-created'));
      const settingsPath = buildProjectWorkspaceAppPath({
        project: json.data,
        suffix: 'settings',
      });

      if (!settingsPath) {
        router.push('/orgs');
        return;
      }

      router.push(settingsPath);
    },
  });

  const onClose = () => {
    setVisible(false);
    router.push(`/orgs`);
  };

  return (
    <Modal open={visible} close={onClose}>
      <form onSubmit={formik.handleSubmit} method="POST">
        <Modal.Header>{t('create-project')}</Modal.Header>
        <Modal.Description>{t('members-of-a-project')}</Modal.Description>
        <Modal.Body>
          <InputWithLabel
            label={t('name')}
            name="name"
            onChange={formik.handleChange}
            value={formik.values.name}
            placeholder={t('project-name')}
            required
          />
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="outline" onClick={onClose} size="md">
            {t('close')}
          </Button>
          <Button
            type="submit"
            color="primary"
            loading={formik.isSubmitting}
            size="md"
            disabled={!formik.dirty || !formik.isValid}
          >
            {t('create-project')}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default CreateProject;
