import fetcher from '@/lib/fetcher';
import {
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import { ApiKey } from '@prisma/client';
import { useRouter } from 'next/router';
import useSWR, { mutate } from 'swr';
import type { ApiResponse } from 'types';

const useAPIKeys = () => {
  const router = useRouter();
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);
  const url = buildWorkspaceApiPath({
    context: routeContext,
    suffix: 'api-keys',
  });

  const { data, error, isLoading } = useSWR<ApiResponse<ApiKey[]>>(() => {
    return url;
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
