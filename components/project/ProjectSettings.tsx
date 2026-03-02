import { Card, InputWithLabel } from '@/components/shared';
import { defaultHeaders } from '@/lib/common';
import {
  buildProjectWorkspaceApiPath,
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import type { Project } from '@prisma/client';
import { useFormik } from 'formik';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import React from 'react';
import { Button } from 'react-daisyui';
import toast from 'react-hot-toast';
import type { ApiResponse } from 'types';

import { AccessControl } from '../shared/AccessControl';
import { z } from 'zod';
import { updateProjectSchema } from '@/lib/zod';
import useProjects from 'hooks/useProjects';

const ProjectSettings = ({ project }: { project: Project }) => {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { mutateProjects } = useProjects();
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);

  const formik = useFormik<z.infer<typeof updateProjectSchema>>({
    initialValues: {
      name: project.name,
      slug: project.slug,
      domain: '',
    },
    validateOnBlur: false,
    enableReinitialize: true,
    validate: (values) => {
      try {
        updateProjectSchema.parse(values);
      } catch (error: any) {
        return error.formErrors.fieldErrors;
      }
    },
    onSubmit: async (values) => {
      const updateTeamUrl =
        buildWorkspaceApiPath({
          context: routeContext,
        }) ?? buildProjectWorkspaceApiPath({ project: project });

      if (!updateTeamUrl) {
        toast.error('Workspace API route could not be resolved.');
        return;
      }

      const response = await fetch(updateTeamUrl, {
        method: 'PUT',
        headers: defaultHeaders,
        body: JSON.stringify(values),
      });

      const json = (await response.json()) as ApiResponse<Project>;

      if (!response.ok) {
        toast.error(json.error.message);
        return;
      }

      const updatedProject = json.data;
      if (!updatedProject) {
        toast.error('Updated project payload is missing.');
        return;
      }

      toast.success(t('successfully-updated'));
      mutateProjects();

      if (!routeContext.organizationSlug) {
        router.push('/orgs');
        return;
      }

      router.push(
        `/orgs/${routeContext.organizationSlug}/projects/${updatedProject.slug}/settings`
      );
    },
  });

  return (
    <>
      <form onSubmit={formik.handleSubmit}>
        <Card>
          <Card.Body>
            <Card.Header>
              <Card.Title>{t('project-settings')}</Card.Title>
              <Card.Description>
                {t('project-settings-config')}
              </Card.Description>
            </Card.Header>
            <div className="flex flex-col gap-4">
              <InputWithLabel
                name="name"
                label={t('project-name')}
                value={formik.values.name}
                onChange={formik.handleChange}
                error={formik.errors.name}
              />
              <InputWithLabel
                name="slug"
                label={t('project-slug')}
                value={formik.values.slug}
                onChange={formik.handleChange}
                error={formik.errors.slug}
              />
              <InputWithLabel
                name="domain"
                label={t('project-domain')}
                value={formik.values.domain ? formik.values.domain : ''}
                onChange={formik.handleChange}
                error={formik.errors.domain}
              />
            </div>
          </Card.Body>
          <AccessControl resource="project" actions={['update']}>
            <Card.Footer>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  color="primary"
                  loading={formik.isSubmitting}
                  disabled={!formik.isValid || !formik.dirty}
                  size="md"
                >
                  {t('save-changes')}
                </Button>
              </div>
            </Card.Footer>
          </AccessControl>
        </Card>
      </form>
    </>
  );
};

export default ProjectSettings;
