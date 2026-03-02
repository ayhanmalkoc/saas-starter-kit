import fetcher from '@/lib/fetcher';
import {
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import type { ProjectMember, User } from '@prisma/client';
import { useRouter } from 'next/router';
import useSWR, { mutate } from 'swr';
import type { ApiResponse } from 'types';

export type ProjectMemberWithUser = ProjectMember & { user: User };

const useProjectMembers = () => {
  const router = useRouter();
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);
  const url = buildWorkspaceApiPath({
    context: routeContext,
    suffix: 'members',
  });

  const { data, error, isLoading } = useSWR<
    ApiResponse<ProjectMemberWithUser[]>
  >(url, fetcher);

  const mutateProjectMembers = async () => {
    if (url) {
      mutate(url);
    }
  };

  return {
    isLoading,
    isError: error,
    members: data?.data,
    mutateProjectMembers,
  };
};

export default useProjectMembers;
