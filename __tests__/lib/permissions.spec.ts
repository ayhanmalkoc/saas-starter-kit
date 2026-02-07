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

  it('grants owner all team resources', () => {
    const ownerResources = permissions.OWNER.map((permission) => permission.resource);

    expect(ownerResources).toEqual([
      'team',
      'team_member',
      'team_invitation',
      'team_sso',
      'team_dsync',
      'team_audit_log',
      'team_payments',
      'team_webhook',
      'team_api_key',
    ]);

    expect(permissions.OWNER.every((permission) => permission.actions === '*')).toBe(true);
  });

  it('restricts members to read and leave team actions', () => {
    expect(permissions.MEMBER).toEqual([
      {
        resource: 'team',
        actions: ['read', 'leave'],
      },
    ]);
  });
});
