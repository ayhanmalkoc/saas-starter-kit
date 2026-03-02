import { Error, LetterAvatar, Loading } from '@/components/shared';
import type { Project, ProjectMember } from '@prisma/client';
import useCanAccess from 'hooks/useCanAccess';
import useProjectMembers, {
  ProjectMemberWithUser,
} from 'hooks/useProjectMembers';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import { Button } from 'react-daisyui';
import toast from 'react-hot-toast';

import { InviteMember } from '@/components/invitation';
import UpdateMemberRole from './UpdateMemberRole';
import { defaultHeaders } from '@/lib/common';
import {
  buildProjectWorkspaceApiPath,
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import type { ApiResponse } from 'types';
import ConfirmationDialog from '../shared/ConfirmationDialog';
import { useState } from 'react';
import { Table } from '@/components/shared/table/Table';
import { useRouter } from 'next/router';

const Members = ({ project }: { project: Project }) => {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useTranslation('common');
  const { canAccess } = useCanAccess();
  const [visible, setVisible] = useState(false);
  const [selectedMember, setSelectedMember] =
    useState<ProjectMemberWithUser | null>(null);
  const [confirmationDialogVisible, setConfirmationDialogVisible] =
    useState(false);
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);

  const { isLoading, isError, members, mutateProjectMembers } =
    useProjectMembers();

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return <Error message={isError.message} />;
  }

  if (!members) {
    return null;
  }

  const removeTeamMember = async (member: ProjectMember | null) => {
    if (!member) {
      return;
    }

    const sp = new URLSearchParams({ memberId: member.userId });
    const membersUrl =
      buildWorkspaceApiPath({
        context: routeContext,
        suffix: 'members',
      }) ??
      buildProjectWorkspaceApiPath({ project: project, suffix: 'members' });

    const response = await fetch(`${membersUrl}?${sp.toString()}`, {
      method: 'DELETE',
      headers: defaultHeaders,
    });

    const json = (await response.json()) as ApiResponse;

    if (!response.ok) {
      toast.error(json.error.message);
      return;
    }

    mutateProjectMembers();
    toast.success(t('member-deleted'));
  };

  const canUpdateRole = (member: ProjectMember) => {
    return (
      session?.user.id != member.userId &&
      canAccess('project_member', ['update'])
    );
  };

  const canRemoveMember = (member: ProjectMember) => {
    return (
      session?.user.id != member.userId &&
      canAccess('project_member', ['delete'])
    );
  };

  const cols = [t('name'), t('email'), t('role')];
  if (canAccess('project_member', ['delete'])) {
    cols.push(t('actions'));
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="space-y-3">
          <h2 className="text-xl font-medium leading-none tracking-tight">
            {t('members')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('members-description')}
          </p>
        </div>
        <Button color="primary" size="md" onClick={() => setVisible(!visible)}>
          {t('add-member')}
        </Button>
      </div>

      <Table
        cols={cols}
        body={members.map((member) => {
          return {
            id: member.id,
            cells: [
              {
                wrap: true,
                element: (
                  <div className="flex items-center justify-start space-x-2">
                    <LetterAvatar name={member.user.name} />
                    <span>{member.user.name}</span>
                  </div>
                ),
                minWidth: 200,
              },
              { wrap: true, text: member.user.email, minWidth: 250 },
              {
                element: canUpdateRole(member) ? (
                  <UpdateMemberRole project={project} member={member} />
                ) : (
                  <span>{member.role}</span>
                ),
              },
              {
                buttons: canRemoveMember(member)
                  ? [
                      {
                        color: 'error',
                        text: t('remove'),
                        onClick: () => {
                          setSelectedMember(member);
                          setConfirmationDialogVisible(true);
                        },
                      },
                    ]
                  : [],
              },
            ],
          };
        })}
      ></Table>

      <ConfirmationDialog
        visible={confirmationDialogVisible}
        onCancel={() => setConfirmationDialogVisible(false)}
        onConfirm={() => removeTeamMember(selectedMember)}
        title={t('confirm-delete-member')}
      >
        {t('delete-member-warning', {
          name: selectedMember?.user.name,
          email: selectedMember?.user.email,
        })}
      </ConfirmationDialog>
      <InviteMember
        visible={visible}
        setVisible={setVisible}
        project={project}
      />
    </div>
  );
};

export default Members;
