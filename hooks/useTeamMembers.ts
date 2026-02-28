import fetcher from '@/lib/fetcher';
import {
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import type { TeamMember, User } from '@prisma/client';
import { useRouter } from 'next/router';
import useSWR, { mutate } from 'swr';
import type { ApiResponse } from 'types';

export type TeamMemberWithUser = TeamMember & { user: User };

const useTeamMembers = (slug: string) => {
  const router = useRouter();
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);
  const url = buildWorkspaceApiPath({
    context: routeContext,
    teamSlug: slug,
    suffix: 'members',
  });

  const { data, error, isLoading } = useSWR<ApiResponse<TeamMemberWithUser[]>>(
    url,
    fetcher
  );

  const mutateTeamMembers = async () => {
    if (url) {
      mutate(url);
    }
  };

  return {
    isLoading,
    isError: error,
    members: data?.data,
    mutateTeamMembers,
  };
};

export default useTeamMembers;
