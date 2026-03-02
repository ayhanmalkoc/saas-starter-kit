import { Role } from '@prisma/client';
import { ApiError } from './errors';
import { getProjectMemberByProjectId } from 'models/projectMember';

export async function validateMembershipOperation(
  memberId: string,
  projectMember,
  operationMeta?: {
    role?: Role;
  }
) {
  const updatingMember = await getProjectMemberByProjectId(
    memberId,
    projectMember.projectId
  );

  if (!updatingMember) {
    throw new ApiError(404, 'Member not found in this project.');
  }
  // Member and Admin can't update the role of Owner
  if (
    (projectMember.role === Role.MEMBER || projectMember.role === Role.ADMIN) &&
    updatingMember.role === Role.OWNER
  ) {
    throw new ApiError(
      403,
      'You do not have permission to update the role of this member.'
    );
  }
  // Member can't update the role of Admin & Owner
  if (
    projectMember.role === Role.MEMBER &&
    (updatingMember.role === Role.ADMIN || updatingMember.role === Role.OWNER)
  ) {
    throw new ApiError(
      403,
      'You do not have permission to update the role of this member.'
    );
  }

  // Admin can't make anyone an Owner
  if (projectMember.role === Role.ADMIN && operationMeta?.role === Role.OWNER) {
    throw new ApiError(
      403,
      'You do not have permission to update the role of this member to Owner.'
    );
  }

  // Member can't make anyone an Admin or Owner
  if (
    projectMember.role === Role.MEMBER &&
    (operationMeta?.role === Role.ADMIN || operationMeta?.role === Role.OWNER)
  ) {
    throw new ApiError(
      403,
      'You do not have permission to update the role of this member to Admin.'
    );
  }
}
