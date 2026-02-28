import { Cog6ToothIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';
import NavigationItems from './NavigationItems';
import { NavigationProps, MenuItem } from './NavigationItems';
import {
  buildWorkspaceAppPath,
  WorkspaceRouteContext,
} from '@/lib/routing/workspace-routes';

interface NavigationItemsProps extends NavigationProps {
  teamSlug: string | null;
  routeContext: WorkspaceRouteContext;
}

const TeamNavigation = ({
  teamSlug,
  routeContext,
  activePathname,
}: NavigationItemsProps) => {
  const { t } = useTranslation('common');
  const workspacePrefix = buildWorkspaceAppPath({
    context: routeContext,
    teamSlug,
  });
  const productsHref =
    buildWorkspaceAppPath({
      context: routeContext,
      teamSlug,
      suffix: 'products',
    }) ?? '/teams';
  const settingsHref =
    buildWorkspaceAppPath({
      context: routeContext,
      teamSlug,
      suffix: 'settings',
    }) ?? '/teams';

  const menus: MenuItem[] = [
    {
      name: t('all-products'),
      href: productsHref,
      icon: CodeBracketIcon,
      active: activePathname === productsHref,
    },
    {
      name: t('settings'),
      href: settingsHref,
      icon: Cog6ToothIcon,
      active:
        Boolean(
          workspacePrefix &&
            activePathname?.startsWith(workspacePrefix) &&
            !activePathname.includes('/products')
        ),
    },
  ];

  return <NavigationItems menus={menus} />;
};

export default TeamNavigation;
