import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import TeamNavigation from './TeamNavigation';
import UserNavigation from './UserNavigation';
import {
  getWorkspaceRouteContextFromQuery,
  hasOrgProjectRouteContext,
} from '@/lib/routing/workspace-routes';

const Navigation = () => {
  const { asPath, isReady, query } = useRouter();
  const [activePathname, setActivePathname] = useState<null | string>(null);

  const routeContext = getWorkspaceRouteContextFromQuery(query);
  const hasWorkspaceContext =
    Boolean(routeContext.teamSlug) || hasOrgProjectRouteContext(routeContext);

  useEffect(() => {
    if (isReady && asPath) {
      const activePathname = new URL(asPath, location.href).pathname;
      setActivePathname(activePathname);
    }
  }, [asPath, isReady]);

  const Navigation = () => {
    if (hasWorkspaceContext) {
      return (
        <TeamNavigation
          activePathname={activePathname}
          teamSlug={routeContext.teamSlug}
          routeContext={routeContext}
        />
      );
    } else {
      return <UserNavigation activePathname={activePathname} />;
    }
  };

  return (
    <nav className="flex flex-1 flex-col">
      <Navigation />
    </nav>
  );
};

export default Navigation;
