import { Role } from '@prisma/client';

import { ApiError } from '@/lib/errors';
import { validateMembershipOperation } from '@/lib/rbac';
import { getTeamMember } from 'models/team';

jest.mock('models/team', () => ({
  getTeamMember: jest.fn(),
}));

const mockedGetTeamMember = jest.mocked(getTeamMember);

const createTeamMember = (role: Role) => ({
  role,
  team: {
    slug: 'acme',
  },
});

describe('lib/rbac validateMembershipOperation', () => {
  beforeEach(() => {
    mockedGetTeamMember.mockReset();
  });

  it('blocks member/admin from changing owner role', async () => {
    mockedGetTeamMember.mockResolvedValue({ role: Role.OWNER });

    await expect(
      validateMembershipOperation('member-1', createTeamMember(Role.ADMIN))
    ).rejects.toEqual(
      expect.objectContaining<ApiError>({
        status: 403,
        message: 'You do not have permission to update the role of this member.',
      })
    );
  });

  it('blocks admin from assigning owner role', async () => {
    mockedGetTeamMember.mockResolvedValue({ role: Role.MEMBER });

    await expect(
      validateMembershipOperation('member-2', createTeamMember(Role.ADMIN), {
        role: Role.OWNER,
      })
    ).rejects.toEqual(
      expect.objectContaining<ApiError>({
        status: 403,
        message:
          'You do not have permission to update the role of this member to Owner.',
      })
    );
  });

  it('blocks member from assigning admin role', async () => {
    mockedGetTeamMember.mockResolvedValue({ role: Role.MEMBER });

    await expect(
      validateMembershipOperation('member-3', createTeamMember(Role.MEMBER), {
        role: Role.ADMIN,
      })
    ).rejects.toEqual(
      expect.objectContaining<ApiError>({
        status: 403,
        message:
          'You do not have permission to update the role of this member to Admin.',
      })
    );
  });

  it('allows owner to update member role', async () => {
    mockedGetTeamMember.mockResolvedValue({ role: Role.ADMIN });

    await expect(
      validateMembershipOperation('member-4', createTeamMember(Role.OWNER), {
        role: Role.MEMBER,
      })
    ).resolves.toBeUndefined();
  });
});
