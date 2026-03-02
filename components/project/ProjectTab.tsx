import {
  Cog6ToothIcon,
  DocumentMagnifyingGlassIcon,
  KeyIcon,
  PaperAirplaneIcon,
  ShieldExclamationIcon,
  UserPlusIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import {
  buildProjectWorkspaceAppPath,
  buildWorkspaceAppPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import type { Project } from '@prisma/client';
import classNames from 'classnames';
import useCanAccess from 'hooks/useCanAccess';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { WorkspaceFeature } from 'types';

interface ProjectTabProps {
  activeTab: string;
  project: Project;
  heading?: string;
  workspaceFeatures: WorkspaceFeature;
}

const ProjectTab = ({
  activeTab,
  project,
  heading,
  workspaceFeatures,
}: ProjectTabProps) => {
  const router = useRouter();
  const { canAccess } = useCanAccess();
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);

  const buildTabHref = (suffix: string) =>
    buildWorkspaceAppPath({
      context: routeContext,
      suffix,
    }) ??
    buildProjectWorkspaceAppPath({ project: project, suffix }) ??
    '/orgs';

  const navigations = [
    {
      name: 'Settings',
      href: buildTabHref('settings'),
      active: activeTab === 'settings',
      icon: Cog6ToothIcon,
    },
  ];

  if (canAccess('project_member', ['create', 'update', 'read', 'delete'])) {
    navigations.push({
      name: 'Members',
      href: buildTabHref('members'),
      active: activeTab === 'members',
      icon: UserPlusIcon,
    });
  }

  if (
    workspaceFeatures.sso &&
    canAccess('project_sso', ['create', 'update', 'read', 'delete'])
  ) {
    navigations.push({
      name: 'Single Sign-On',
      href: buildTabHref('sso'),
      active: activeTab === 'sso',
      icon: ShieldExclamationIcon,
    });
  }

  if (
    workspaceFeatures.dsync &&
    canAccess('project_dsync', ['create', 'update', 'read', 'delete'])
  ) {
    navigations.push({
      name: 'Directory Sync',
      href: buildTabHref('directory-sync'),
      active: activeTab === 'directory-sync',
      icon: UserPlusIcon,
    });
  }

  if (
    workspaceFeatures.auditLog &&
    canAccess('project_audit_log', ['create', 'update', 'read', 'delete'])
  ) {
    navigations.push({
      name: 'Audit Logs',
      href: buildTabHref('audit-logs'),
      active: activeTab === 'audit-logs',
      icon: DocumentMagnifyingGlassIcon,
    });
  }

  if (
    workspaceFeatures.payments &&
    canAccess('project_payments', ['create', 'update', 'read', 'delete'])
  ) {
    navigations.push({
      name: 'Billing',
      href: buildTabHref('billing'),
      active: activeTab === 'payments',
      icon: BanknotesIcon,
    });
  }

  if (
    workspaceFeatures.webhook &&
    canAccess('project_webhook', ['create', 'update', 'read', 'delete'])
  ) {
    navigations.push({
      name: 'Webhooks',
      href: buildTabHref('webhooks'),
      active: activeTab === 'webhooks',
      icon: PaperAirplaneIcon,
    });
  }

  if (
    workspaceFeatures.apiKey &&
    canAccess('project_api_key', ['create', 'update', 'read', 'delete'])
  ) {
    navigations.push({
      name: 'API Keys',
      href: buildTabHref('api-keys'),
      active: activeTab === 'api-keys',
      icon: KeyIcon,
    });
  }

  return (
    <div className="flex flex-col pb-6">
      <h2 className="text-xl font-semibold mb-2">
        {heading ? heading : project.name}
      </h2>
      <nav
        className=" flex flex-wrap border-b border-gray-300"
        aria-label="Tabs"
      >
        {navigations.map((menu) => {
          return (
            <Link
              href={menu.href}
              key={`${menu.name}-${menu.href}`}
              className={classNames(
                'inline-flex items-center border-b-2 py-2 md-py-4 mr-5 text-sm font-medium',
                menu.active
                  ? 'border-gray-900 text-gray-700 dark:text-gray-100'
                  : 'border-transparent text-gray-500 hover:border-gray-300  hover:text-gray-700 hover:dark:text-gray-100'
              )}
            >
              {menu.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default ProjectTab;
