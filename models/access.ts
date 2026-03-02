import { getWorkspaceRouteContextFromQuery } from '@/lib/routing/workspace-routes';
import { getSession } from '@/lib/session';
import { ApiError } from '@/lib/errors';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUser } from './user';
import { getOrganizationMemberBySlug } from './organizationMember';
import {
  getProjectMemberByOrgAndProjectSlug,
  getProjectMemberByProjectId,
} from './projectMember';

const getRequiredOrganizationAndProjectSlugs = (
  query: NextApiRequest['query']
) => {
  const routeContext = getWorkspaceRouteContextFromQuery({
    orgSlug: query.orgSlug,
    projectSlug: query.projectSlug,
  });

  if (!routeContext.organizationSlug || !routeContext.projectSlug) {
    throw new ApiError(400, 'Organization and project slugs are required.');
  }

  return {
    organizationSlug: routeContext.organizationSlug,
    projectSlug: routeContext.projectSlug,
  };
};

export const getProjectMembershipByRoute = async (
  userId: string,
  query: NextApiRequest['query']
) => {
  const { organizationSlug, projectSlug } =
    getRequiredOrganizationAndProjectSlugs(query);

  const projectMember = await getProjectMemberByOrgAndProjectSlug(
    userId,
    organizationSlug,
    projectSlug
  );

  if (!projectMember) {
    throw new ApiError(403, 'You do not have access to this project.');
  }

  return projectMember;
};

export const throwIfNoOrganizationAccess = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  const session = await getSession(req, res);

  if (!session?.user?.id) {
    throw new ApiError(401, 'Unauthorized');
  }

  const routeContext = getWorkspaceRouteContextFromQuery({
    orgSlug: req.query.orgSlug,
  });

  if (!routeContext.organizationSlug) {
    throw new ApiError(400, 'Organization slug is required.');
  }

  const organizationMember = await getOrganizationMemberBySlug(
    session.user.id,
    routeContext.organizationSlug
  );

  if (!organizationMember) {
    throw new ApiError(403, 'You do not have access to this organization.');
  }

  return {
    ...organizationMember,
    user: {
      ...session.user,
    },
  };
};

export const throwIfNoProjectAccess = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  const session = await getSession(req, res);

  if (!session?.user?.id) {
    throw new ApiError(401, 'Unauthorized');
  }

  const projectMember = await getProjectMembershipByRoute(
    session.user.id,
    req.query
  );

  return {
    ...projectMember,
    projectId: projectMember.projectId,
    organizationId: projectMember.project.organizationId,
    organization: projectMember.project.organization,
    user: {
      ...session.user,
    },
  };
};

export const getCurrentUserWithProject = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  const user = await getCurrentUser(req, res);
  const projectMember = await getProjectMembershipByRoute(user.id, req.query);

  return {
    ...user,
    role: projectMember.role,
    project: projectMember.project,
    projectId: projectMember.projectId,
    organization: projectMember.project.organization,
    organizationId: projectMember.project.organizationId,
  };
};

export const getProjectMemberByProjectIdAndUserId = async (
  projectId: string,
  userId: string
) => {
  const projectMember = await getProjectMemberByProjectId(userId, projectId);

  if (!projectMember) {
    throw new ApiError(403, 'You do not have access to this project.');
  }

  return projectMember;
};
