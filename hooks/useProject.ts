import fetcher from '@/lib/fetcher';
import {
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import type { Project } from '@prisma/client';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import type { ApiResponse } from 'types';

const useProject = () => {
  const { query, isReady } = useRouter();
  const routeContext = getWorkspaceRouteContextFromQuery(query);
  const url = isReady
    ? buildWorkspaceApiPath({
        context: routeContext,
      })
    : null;

  const { data, error, isLoading } = useSWR<ApiResponse<Project>>(url, fetcher);

  return {
    isLoading,
    isError: error,
    project: data?.data,
  };
};

export default useProject;
