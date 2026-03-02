import { Role } from '@prisma/client';

import { availableRoles, permissions } from '@/lib/permissions';

describe('lib/permissions', () => {
  it('returns available roles in expected order', () => {
    expect(availableRoles).toEqual([
      { id: Role.MEMBER, name: 'Member' },
      { id: Role.ADMIN, name: 'Admin' },
      { id: Role.OWNER, name: 'Owner' },
    ]);
  });

  it('grants owner all project resources', () => {
    const ownerResources = permissions.OWNER.map(
      (permission) => permission.resource
    );

    expect(ownerResources).toEqual([
      'project',
      'project_member',
      'project_invitation',
      'project_sso',
      'project_dsync',
      'project_audit_log',
      'project_payments',
      'project_webhook',
      'project_api_key',
    ]);

    expect(
      permissions.OWNER.every((permission) => permission.actions === '*')
    ).toBe(true);
  });

  it('restricts members to read and leave project actions', () => {
    expect(permissions.MEMBER).toEqual([
      {
        resource: 'project',
        actions: ['read', 'leave'],
      },
    ]);
  });
});
