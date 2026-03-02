import { defaultHeaders } from '@/lib/common';
import {
  buildProjectWorkspaceApiPath,
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import { availableRoles } from '@/lib/permissions';
import type { Project, ProjectMember } from '@prisma/client';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import toast from 'react-hot-toast';
import type { ApiResponse } from 'types';

interface UpdateMemberRoleProps {
  project: Project;
  member: ProjectMember;
}

const UpdateMemberRole = ({ project, member }: UpdateMemberRoleProps) => {
  const router = useRouter();
  const { t } = useTranslation('common');
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);

  const updateRole = async (member: ProjectMember, role: string) => {
    const membersUrl =
      buildWorkspaceApiPath({
        context: routeContext,
        suffix: 'members',
      }) ??
      buildProjectWorkspaceApiPath({ project: project, suffix: 'members' });

    if (!membersUrl) {
      toast.error('Workspace API route could not be resolved.');
      return;
    }

    const response = await fetch(membersUrl, {
      method: 'PATCH',
      headers: defaultHeaders,
      body: JSON.stringify({
        memberId: member.userId,
        role,
      }),
    });

    const json = (await response.json()) as ApiResponse;

    if (!response.ok) {
      toast.error(json.error.message);
      return;
    }

    toast.success(t('member-role-updated'));
  };

  return (
    <select
      className="select select-bordered select-sm rounded"
      defaultValue={member.role}
      onChange={(e) => updateRole(member, e.target.value)}
    >
      {availableRoles.map((role) => (
        <option value={role.id} key={role.id}>
          {role.id}
        </option>
      ))}
    </select>
  );
};

export default UpdateMemberRole;
