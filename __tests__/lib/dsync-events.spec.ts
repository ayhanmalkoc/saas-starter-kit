import { Role } from '@prisma/client';

jest.mock('models/team', () => ({
  addTeamMember: jest.fn(),
  removeTeamMember: jest.fn(),
}));

jest.mock('models/user', () => ({
  upsertUser: jest.fn(),
  getUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
}));

jest.mock('models/teamMember', () => ({
  countTeamMembers: jest.fn(),
}));

import { handleEvents } from '@/lib/jackson/dsyncEvents';
import { addTeamMember, removeTeamMember } from 'models/team';
import { deleteUser, getUser, upsertUser } from 'models/user';
import { countTeamMembers } from 'models/teamMember';

const groupUserAddedPayload = {
  event: 'group.user_added',
  tenant: 'team_123',
  data: {
    id: 'user_1',
    email: 'member@example.com',
    first_name: 'Team',
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
  tenant: 'team_123',
  data: {
    id: 'user_1',
    email: 'member@example.com',
    first_name: 'Team',
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
  });

  it('adds membership idempotently for group.user_added events', async () => {
    (upsertUser as jest.Mock).mockResolvedValue({
      id: 'user_db_1',
      email: 'member@example.com',
    });

    await handleEvents(groupUserAddedPayload);
    await handleEvents(groupUserAddedPayload);

    expect(upsertUser).toHaveBeenCalledTimes(2);
    expect(addTeamMember).toHaveBeenCalledTimes(2);
    expect(addTeamMember).toHaveBeenNthCalledWith(
      1,
      'team_123',
      'user_db_1',
      Role.MEMBER
    );
    expect(addTeamMember).toHaveBeenNthCalledWith(
      2,
      'team_123',
      'user_db_1',
      Role.MEMBER
    );
  });

  it('removes membership for group.user_removed and ignores repeated events', async () => {
    (getUser as jest.Mock).mockResolvedValue({
      id: 'user_db_1',
      email: 'member@example.com',
    });

    (countTeamMembers as jest.Mock)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    await handleEvents(groupUserRemovedPayload);
    await handleEvents(groupUserRemovedPayload);

    expect(removeTeamMember).toHaveBeenCalledTimes(1);
    expect(removeTeamMember).toHaveBeenCalledWith('team_123', 'user_db_1');
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith({ email: 'member@example.com' });
  });

  it('is a safe no-op for unknown or unsupported group events', async () => {
    await handleEvents({
      event: 'group.unknown',
      tenant: 'team_123',
      data: {
        id: 'group_1',
        name: 'Engineering',
      },
    } as any);

    await handleEvents({
      event: 'group.created',
      tenant: 'team_123',
      data: {
        id: 'group_1',
        name: 'Engineering',
      },
    } as any);

    expect(upsertUser).not.toHaveBeenCalled();
    expect(addTeamMember).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
    expect(removeTeamMember).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
