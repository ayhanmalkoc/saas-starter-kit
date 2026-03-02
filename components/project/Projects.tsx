import { LetterAvatar } from '@/components/shared';
import { defaultHeaders } from '@/lib/common';
import {
  buildProjectWorkspaceApiPath,
  buildProjectWorkspaceAppPath,
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import useProjects from 'hooks/useProjects';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from 'react-daisyui';
import toast from 'react-hot-toast';
import type { ApiResponse, ProjectWithMemberCount } from 'types';
import { useRouter } from 'next/router';
import ConfirmationDialog from '../shared/ConfirmationDialog';
import { WithLoadingAndError } from '@/components/shared';
import CreateProject from './CreateProject';
import { Table } from '@/components/shared/table/Table';

const Projects = () => {
  const router = useRouter();
  const { t } = useTranslation('common');
  const [selectedProject, setSelectedProject] =
    useState<ProjectWithMemberCount | null>(null);
  const { isLoading, isError, projects, mutateProjects } = useProjects();
  const [askConfirmation, setAskConfirmation] = useState(false);
  const [createProjectVisible, setCreateProjectVisible] = useState(false);

  const { newProject } = router.query as { newProject: string };
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);

  useEffect(() => {
    if (newProject) {
      setCreateProjectVisible(true);
    }
  }, [newProject]);

  const leaveProject = async (project: ProjectWithMemberCount) => {
    const membersUrl =
      buildWorkspaceApiPath({
        context: routeContext,
        suffix: 'members',
      }) ?? buildProjectWorkspaceApiPath({ project, suffix: 'members' });

    if (!membersUrl) {
      toast.error('Workspace API route could not be resolved.');
      return;
    }

    const response = await fetch(membersUrl, {
      method: 'PUT',
      headers: defaultHeaders,
    });

    const json = (await response.json()) as ApiResponse;

    if (!response.ok) {
      toast.error(json.error.message);
      return;
    }

    toast.success(t('leave-project-success'));
    mutateProjects();
  };

  return (
    <WithLoadingAndError isLoading={isLoading} error={isError}>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="space-y-3">
            <h2 className="text-xl font-medium leading-none tracking-tight">
              {t('all-projects')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('project-listed')}
            </p>
          </div>
          <Button
            color="primary"
            size="md"
            onClick={() => setCreateProjectVisible(!createProjectVisible)}
          >
            {t('create-project')}
          </Button>
        </div>

        <Table
          cols={[t('name'), t('members'), t('created-at'), t('actions')]}
          body={
            projects
              ? projects.map((project) => {
                  return {
                    id: project.id,
                    cells: [
                      {
                        wrap: true,
                        element: (
                          <Link
                            href={
                              buildProjectWorkspaceAppPath({
                                project,
                                suffix: 'members',
                              }) ?? '/orgs'
                            }
                          >
                            <div className="flex items-center justify-start space-x-2">
                              <LetterAvatar name={project.name} />
                              <span className="underline">{project.name}</span>
                            </div>
                          </Link>
                        ),
                      },
                      { wrap: true, text: '' + project._count.members },
                      {
                        wrap: true,
                        text: new Date(project.createdAt).toDateString(),
                      },
                      {
                        buttons: [
                          {
                            color: 'error',
                            text: t('leave-project'),
                            onClick: () => {
                              setSelectedProject(project);
                              setAskConfirmation(true);
                            },
                          },
                        ],
                      },
                    ],
                  };
                })
              : []
          }
        ></Table>

        <ConfirmationDialog
          visible={askConfirmation}
          title={`${t('leave-project')} ${selectedProject?.name}`}
          onCancel={() => setAskConfirmation(false)}
          onConfirm={() => {
            if (selectedProject) {
              leaveProject(selectedProject);
            }
          }}
          confirmText={t('leave-project')}
        >
          {t('leave-project-confirmation')}
        </ConfirmationDialog>
        <CreateProject
          visible={createProjectVisible}
          setVisible={setCreateProjectVisible}
        />
      </div>
    </WithLoadingAndError>
  );
};

export default Projects;
