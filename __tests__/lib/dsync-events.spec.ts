import { Role } from '@prisma/client';

jest.mock('models/projectMember', () => ({
  addProjectMember: jest.fn(),
  removeProjectMember: jest.fn(),
  countProjectMembers: jest.fn(),
}));

jest.mock('models/organizationMember', () => ({
  addOrganizationMember: jest.fn(),
}));

jest.mock('models/project', () => ({
  getProjectById: jest.fn(),
}));

jest.mock('models/user', () => ({
  upsertUser: jest.fn(),
  getUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
}));

import { handleEvents } from '@/lib/jackson/dsyncEvents';
import {
  addProjectMember,
  removeProjectMember,
  countProjectMembers,
} from 'models/projectMember';
import { addOrganizationMember } from 'models/organizationMember';
import { getProjectById } from 'models/project';
import { deleteUser, getUser, upsertUser } from 'models/user';

const groupUserAddedPayload = {
  event: 'group.user_added',
  tenant: 'project_123',
  data: {
    id: 'user_1',
    email: 'member@example.com',
    first_name: 'Project',
    last_name: 'Member',
    active: true,
    group: {
      id: 'group_1',
      name: 'Engineering',
    },
  },
} as any;

const groupUserRemovedPayload = {
  event: 'group.user_removed',
  tenant: 'project_123',
  data: {
    id: 'user_1',
    email: 'member@example.com',
    first_name: 'Project',
    last_name: 'Member',
    active: true,
    group: {
      id: 'group_1',
      name: 'Engineering',
    },
  },
} as any;

describe('handleEvents group events', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getProjectById as jest.Mock).mockResolvedValue({
      id: 'project_123',
      organizationId: 'org_123',
    });
  });

  it('adds membership idempotently for group.user_added events', async () => {
    (upsertUser as jest.Mock).mockResolvedValue({
      id: 'user_db_1',
      email: 'member@example.com',
    });

    await handleEvents(groupUserAddedPayload);
    await handleEvents(groupUserAddedPayload);

    expect(upsertUser).toHaveBeenCalledTimes(2);
    expect(addOrganizationMember).toHaveBeenCalledTimes(2);
    expect(addProjectMember).toHaveBeenCalledTimes(2);
    expect(addProjectMember).toHaveBeenNthCalledWith(
      1,
      'project_123',
      'user_db_1',
      Role.MEMBER
    );
    expect(addProjectMember).toHaveBeenNthCalledWith(
      2,
      'project_123',
      'user_db_1',
      Role.MEMBER
    );
  });

  it('removes membership for group.user_removed and ignores repeated events', async () => {
    (getUser as jest.Mock).mockResolvedValue({
      id: 'user_db_1',
      email: 'member@example.com',
    });

    (countProjectMembers as jest.Mock)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    await handleEvents(groupUserRemovedPayload);
    await handleEvents(groupUserRemovedPayload);

    expect(removeProjectMember).toHaveBeenCalledTimes(1);
    expect(removeProjectMember).toHaveBeenCalledWith(
      'project_123',
      'user_db_1'
    );
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith({ email: 'member@example.com' });
  });

  it('skips cleanup for repeated user.updated deactivation when membership is already removed', async () => {
    (getUser as jest.Mock).mockResolvedValue({
      id: 'user_db_1',
      email: 'member@example.com',
    });

    (countProjectMembers as jest.Mock).mockResolvedValueOnce(0);

    await handleEvents({
      event: 'user.updated',
      tenant: 'project_123',
      data: {
        id: 'user_1',
        email: 'member@example.com',
        first_name: 'Project',
        last_name: 'Member',
        active: false,
      },
    } as any);

    expect(removeProjectMember).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
    expect(countProjectMembers).toHaveBeenCalledTimes(1);
  });

  it('is a safe no-op for unknown or unsupported group events', async () => {
    await handleEvents({
      event: 'group.unknown',
      tenant: 'project_123',
      data: {
        id: 'group_1',
        name: 'Engineering',
      },
    } as any);

    await handleEvents({
      event: 'group.created',
      tenant: 'project_123',
      data: {
        id: 'group_1',
        name: 'Engineering',
      },
    } as any);

    expect(upsertUser).not.toHaveBeenCalled();
    expect(addOrganizationMember).not.toHaveBeenCalled();
    expect(addProjectMember).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
    expect(removeProjectMember).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
