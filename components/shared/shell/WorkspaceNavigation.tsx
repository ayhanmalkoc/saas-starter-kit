import { Cog6ToothIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';
import NavigationItems from './NavigationItems';
import { NavigationProps, MenuItem } from './NavigationItems';
import {
  buildWorkspaceAppPath,
  WorkspaceRouteContext,
} from '@/lib/routing/workspace-routes';

interface NavigationItemsProps extends NavigationProps {
  routeContext: WorkspaceRouteContext;
}

const WorkspaceNavigation = ({
  routeContext,
  activePathname,
}: NavigationItemsProps) => {
  const { t } = useTranslation('common');
  const workspacePrefix = buildWorkspaceAppPath({
    context: routeContext,
  });
  const productsHref =
    buildWorkspaceAppPath({
      context: routeContext,
      suffix: 'products',
    }) ?? '/orgs';
  const settingsHref =
    buildWorkspaceAppPath({
      context: routeContext,
      suffix: 'settings',
    }) ?? '/orgs';

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
      active: Boolean(
        workspacePrefix &&
        activePathname?.startsWith(workspacePrefix) &&
        !activePathname.includes('/products')
      ),
    },
  ];

  return <NavigationItems menus={menus} />;
};

export default WorkspaceNavigation;
