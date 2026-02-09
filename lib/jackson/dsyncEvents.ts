import { DirectorySyncEvent } from '@boxyhq/saml-jackson';
import { Role } from '@prisma/client';
import { addTeamMember, removeTeamMember } from 'models/team';
import { deleteUser, getUser, updateUser, upsertUser } from 'models/user';
import { countTeamMembers } from 'models/teamMember';

const removeMembershipIfExists = async (teamId: string, userId: string) => {
  const membershipCount = await countTeamMembers({
    where: {
      teamId,
      userId,
    },
  });

  if (membershipCount === 0) {
    return false;
  }

  await removeTeamMember(teamId, userId);

  return true;
};

// Handle SCIM events
export const handleEvents = async (event: DirectorySyncEvent) => {
  const { event: action, tenant: teamId, data } = event;

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

    await addTeamMember(teamId, user.id, Role.MEMBER);

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

    const removedMembership = await removeMembershipIfExists(teamId, user.id);

    if (!removedMembership) {
      return;
    }

    const otherTeamsCount = await countTeamMembers({
      where: {
        userId: user.id,
      },
    });

    if (otherTeamsCount === 0) {
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

    await addTeamMember(teamId, user.id, Role.MEMBER);
  }

  // User has been updated
  else if (action === 'user.updated') {
    const user = await getUser({ email });

    if (!user) {
      return;
    }

    // Deactivation of user by removing them from the team
    if (active === false) {
      const removedMembership = await removeMembershipIfExists(teamId, user.id);

      if (!removedMembership) {
        return;
      }

      const otherTeamsCount = await countTeamMembers({
        where: {
          userId: user.id,
        },
      });

      if (otherTeamsCount === 0) {
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

    // Reactivation of user by adding them back to the team
    await addTeamMember(teamId, user.id, Role.MEMBER);
  }

  // User has been removed
  else if (action === 'user.deleted') {
    const user = await getUser({ email });

    if (!user) {
      return;
    }

    const removedMembership = await removeMembershipIfExists(teamId, user.id);

    if (!removedMembership) {
      return;
    }

    const otherTeamsCount = await countTeamMembers({
      where: {
        userId: user.id,
      },
    });

    if (otherTeamsCount === 0) {
      await deleteUser({ email: user.email });
    }
  }
};
