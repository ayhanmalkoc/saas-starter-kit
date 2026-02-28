import fetcher from '@/lib/fetcher';
import {
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import type { Team } from '@prisma/client';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import type { ApiResponse } from 'types';

const useTeam = (slug?: string) => {
  const { query, isReady } = useRouter();

  const routeContext = getWorkspaceRouteContextFromQuery(query);
  const teamSlug = slug || (isReady ? routeContext.teamSlug : null);
  const url = isReady
    ? buildWorkspaceApiPath({
        context: routeContext,
        teamSlug,
      })
    : null;

  const { data, error, isLoading } = useSWR<ApiResponse<Team>>(
    url,
    fetcher
  );

  return {
    isLoading,
    isError: error,
    team: data?.data,
  };
};

export default useTeam;
