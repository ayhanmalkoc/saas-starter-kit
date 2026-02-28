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
  buildTeamWorkspaceAppPath,
  buildWorkspaceAppPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import type { Team } from '@prisma/client';
import classNames from 'classnames';
import useCanAccess from 'hooks/useCanAccess';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { TeamFeature } from 'types';

interface TeamTabProps {
  activeTab: string;
  team: Team;
  heading?: string;
  teamFeatures: TeamFeature;
}

const TeamTab = ({ activeTab, team, heading, teamFeatures }: TeamTabProps) => {
  const router = useRouter();
  const { canAccess } = useCanAccess();
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);

  const buildTabHref = (suffix: string) =>
    buildWorkspaceAppPath({
      context: routeContext,
      teamSlug: team.slug,
      suffix,
    }) ?? buildTeamWorkspaceAppPath({ team, suffix });

  const navigations = [
    {
      name: 'Settings',
      href: buildTabHref('settings'),
      active: activeTab === 'settings',
      icon: Cog6ToothIcon,
    },
  ];

  if (canAccess('team_member', ['create', 'update', 'read', 'delete'])) {
    navigations.push({
      name: 'Members',
      href: buildTabHref('members'),
      active: activeTab === 'members',
      icon: UserPlusIcon,
    });
  }

  if (
    teamFeatures.sso &&
    canAccess('team_sso', ['create', 'update', 'read', 'delete'])
  ) {
    navigations.push({
      name: 'Single Sign-On',
      href: buildTabHref('sso'),
      active: activeTab === 'sso',
      icon: ShieldExclamationIcon,
    });
  }

  if (
    teamFeatures.dsync &&
    canAccess('team_dsync', ['create', 'update', 'read', 'delete'])
  ) {
    navigations.push({
      name: 'Directory Sync',
      href: buildTabHref('directory-sync'),
      active: activeTab === 'directory-sync',
      icon: UserPlusIcon,
    });
  }

  if (
    teamFeatures.auditLog &&
    canAccess('team_audit_log', ['create', 'update', 'read', 'delete'])
  ) {
    navigations.push({
      name: 'Audit Logs',
      href: buildTabHref('audit-logs'),
      active: activeTab === 'audit-logs',
      icon: DocumentMagnifyingGlassIcon,
    });
  }

  if (
    teamFeatures.payments &&
    canAccess('team_payments', ['create', 'update', 'read', 'delete'])
  ) {
    navigations.push({
      name: 'Billing',
      href: buildTabHref('billing'),
      active: activeTab === 'payments',
      icon: BanknotesIcon,
    });
  }

  if (
    teamFeatures.webhook &&
    canAccess('team_webhook', ['create', 'update', 'read', 'delete'])
  ) {
    navigations.push({
      name: 'Webhooks',
      href: buildTabHref('webhooks'),
      active: activeTab === 'webhooks',
      icon: PaperAirplaneIcon,
    });
  }

  if (
    teamFeatures.apiKey &&
    canAccess('team_api_key', ['create', 'update', 'read', 'delete'])
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
        {heading ? heading : team.name}
      </h2>
      <nav
        className=" flex flex-wrap border-b border-gray-300"
        aria-label="Tabs"
      >
        {navigations.map((menu) => {
          return (
            <Link
              href={menu.href}
              key={menu.href}
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

export default TeamTab;
