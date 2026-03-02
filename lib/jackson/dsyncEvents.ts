import { DirectorySyncEvent } from '@boxyhq/saml-jackson';
import { Role } from '@prisma/client';
import {
  addProjectMember,
  countProjectMembers,
  removeProjectMember,
} from 'models/projectMember';
import { addOrganizationMember } from 'models/organizationMember';
import { deleteUser, getUser, updateUser, upsertUser } from 'models/user';
import { getProjectById } from 'models/project';

const removeMembershipIfExists = async (projectId: string, userId: string) => {
  const membershipCount = await countProjectMembers({
    where: {
      projectId,
      userId,
    },
  });

  if (membershipCount === 0) {
    return false;
  }

  await removeProjectMember(projectId, userId);

  return true;
};

const addMemberships = async (
  projectId: string,
  userId: string,
  role: Role
) => {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error(
      `Project not found for directory event tenant ${projectId}`
    );
  }

  await addOrganizationMember(project.organizationId, userId, role);
  await addProjectMember(projectId, userId, role);
};

// Handle SCIM events
export const handleEvents = async (event: DirectorySyncEvent) => {
  const { event: action, tenant: projectId, data } = event;

  if (
    action === 'group.created' ||
    action === 'group.updated' ||
    action === 'group.deleted'
  ) {
    return;
  }

  if (action === 'group.user_added') {
    if (!('email' in data)) {
      return;
    }

    const { email, first_name, last_name } = data;
    const name = `${first_name} ${last_name}`;

    const user = await upsertUser({
      where: {
        email,
      },
      update: {
        name,
      },
      create: {
        email,
        name,
      },
    });

    await addMemberships(projectId, user.id, Role.MEMBER);

    return;
  }

  if (action === 'group.user_removed') {
    if (!('email' in data)) {
      return;
    }

    const user = await getUser({ email: data.email });

    if (!user) {
      return;
    }

    const removedMembership = await removeMembershipIfExists(
      projectId,
      user.id
    );

    if (!removedMembership) {
      return;
    }

    const otherProjectsCount = await countProjectMembers({
      where: {
        userId: user.id,
      },
    });

    if (otherProjectsCount === 0) {
      await deleteUser({ email: user.email });
    }

    return;
  }

  if (!('email' in data)) {
    return;
  }

  const { email, first_name, last_name, active } = data;
  const name = `${first_name} ${last_name}`;

  // User has been added
  if (action === 'user.created') {
    const user = await upsertUser({
      where: {
        email,
      },
      update: {
        name,
      },
      create: {
        email,
        name,
      },
    });

    await addMemberships(projectId, user.id, Role.MEMBER);
  }

  // User has been updated
  else if (action === 'user.updated') {
    const user = await getUser({ email });

    if (!user) {
      return;
    }

    // Deactivation of user by removing them from the project
    if (active === false) {
      const removedMembership = await removeMembershipIfExists(
        projectId,
        user.id
      );

      if (!removedMembership) {
        return;
      }

      const otherProjectsCount = await countProjectMembers({
        where: {
          userId: user.id,
        },
      });

      if (otherProjectsCount === 0) {
        await deleteUser({ email: user.email });
      }

      return;
    }

    await updateUser({
      where: {
        email,
      },
      data: {
        name,
      },
    });

    // Reactivation of user by adding them back to the project
    await addMemberships(projectId, user.id, Role.MEMBER);
  }

  // User has been removed
  else if (action === 'user.deleted') {
    const user = await getUser({ email });

    if (!user) {
      return;
    }

    const removedMembership = await removeMembershipIfExists(
      projectId,
      user.id
    );

    if (!removedMembership) {
      return;
    }

    const otherProjectsCount = await countProjectMembers({
      where: {
        userId: user.id,
      },
    });

    if (otherProjectsCount === 0) {
      await deleteUser({ email: user.email });
    }
  }
};
