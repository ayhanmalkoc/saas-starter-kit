import { Role } from '@prisma/client';

type RoleType = (typeof Role)[keyof typeof Role];
export type Action = 'create' | 'update' | 'read' | 'delete' | 'leave';
export type Resource =
  | 'project'
  | 'project_member'
  | 'project_invitation'
  | 'project_sso'
  | 'project_dsync'
  | 'project_audit_log'
  | 'project_webhook'
  | 'project_payments'
  | 'project_api_key';

type RolePermissions = {
  [role in RoleType]: Permission[];
};

export type Permission = {
  resource: Resource;
  actions: Action[] | '*';
};

export const availableRoles = [
  {
    id: Role.MEMBER,
    name: 'Member',
  },
  {
    id: Role.ADMIN,
    name: 'Admin',
  },
  {
    id: Role.OWNER,
    name: 'Owner',
  },
];

export const permissions: RolePermissions = {
  OWNER: [
    {
      resource: 'project',
      actions: '*',
    },
    {
      resource: 'project_member',
      actions: '*',
    },
    {
      resource: 'project_invitation',
      actions: '*',
    },
    {
      resource: 'project_sso',
      actions: '*',
    },
    {
      resource: 'project_dsync',
      actions: '*',
    },
    {
      resource: 'project_audit_log',
      actions: '*',
    },
    {
      resource: 'project_payments',
      actions: '*',
    },
    {
      resource: 'project_webhook',
      actions: '*',
    },
    {
      resource: 'project_api_key',
      actions: '*',
    },
  ],
  ADMIN: [
    {
      resource: 'project',
      actions: '*',
    },
    {
      resource: 'project_member',
      actions: '*',
    },
    {
      resource: 'project_invitation',
      actions: '*',
    },
    {
      resource: 'project_sso',
      actions: '*',
    },
    {
      resource: 'project_dsync',
      actions: '*',
    },
    {
      resource: 'project_audit_log',
      actions: '*',
    },
    {
      resource: 'project_webhook',
      actions: '*',
    },
    {
      resource: 'project_api_key',
      actions: '*',
    },
  ],
  MEMBER: [
    {
      resource: 'project',
      actions: ['read', 'leave'],
    },
  ],
};
