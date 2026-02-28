import fetcher from '@/lib/fetcher';
import {
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import { ApiKey } from '@prisma/client';
import { useRouter } from 'next/router';
import useSWR, { mutate } from 'swr';
import type { ApiResponse } from 'types';

const useAPIKeys = (slug: string | undefined) => {
  const router = useRouter();
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);
  const url = buildWorkspaceApiPath({
    context: routeContext,
    teamSlug: slug,
    suffix: 'api-keys',
  });

  const { data, error, isLoading } = useSWR<ApiResponse<ApiKey[]>>(() => {
    return slug && url ? url : null;
  }, fetcher);

  const mutateAPIKeys = async () => {
    if (url) {
      mutate(url);
    }
  };

  return {
    data,
    isLoading,
    error,
    mutate: mutateAPIKeys,
  };
};

export default useAPIKeys;
