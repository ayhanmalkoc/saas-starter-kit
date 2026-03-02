import { Role } from '@prisma/client';

import { ApiError } from '@/lib/errors';
import { validateMembershipOperation } from '@/lib/rbac';
import { getProjectMemberByProjectId } from 'models/projectMember';

jest.mock('models/projectMember', () => ({
  getProjectMemberByProjectId: jest.fn(),
}));

const mockedGetProjectMemberByProjectId = jest.mocked(
  getProjectMemberByProjectId
);

const createProjectMember = (role: Role) => ({
  role,
  projectId: 'project_123',
});

describe('lib/rbac validateMembershipOperation', () => {
  beforeEach(() => {
    mockedGetProjectMemberByProjectId.mockReset();
  });

  it('blocks member/admin from changing owner role', async () => {
    mockedGetProjectMemberByProjectId.mockResolvedValue({
      role: Role.OWNER,
    } as any);

    await expect(
      validateMembershipOperation('member-1', createProjectMember(Role.ADMIN))
    ).rejects.toEqual(
      expect.objectContaining<ApiError>({
        status: 403,
        message:
          'You do not have permission to update the role of this member.',
      })
    );
  });

  it('blocks admin from assigning owner role', async () => {
    mockedGetProjectMemberByProjectId.mockResolvedValue({
      role: Role.MEMBER,
    } as any);

    await expect(
      validateMembershipOperation('member-2', createProjectMember(Role.ADMIN), {
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
    mockedGetProjectMemberByProjectId.mockResolvedValue({
      role: Role.MEMBER,
    } as any);

    await expect(
      validateMembershipOperation(
        'member-3',
        createProjectMember(Role.MEMBER),
        {
          role: Role.ADMIN,
        }
      )
    ).rejects.toEqual(
      expect.objectContaining<ApiError>({
        status: 403,
        message:
          'You do not have permission to update the role of this member to Admin.',
      })
    );
  });

  it('allows owner to update member role', async () => {
    mockedGetProjectMemberByProjectId.mockResolvedValue({
      role: Role.ADMIN,
    } as any);

    await expect(
      validateMembershipOperation('member-4', createProjectMember(Role.OWNER), {
        role: Role.MEMBER,
      })
    ).resolves.toBeUndefined();
  });
});
