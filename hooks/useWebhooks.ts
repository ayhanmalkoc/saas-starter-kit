import fetcher from '@/lib/fetcher';
import {
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import { useRouter } from 'next/router';
import type { EndpointOut } from 'svix';
import useSWR, { mutate } from 'swr';
import type { ApiResponse } from 'types';

const useWebhooks = (slug: string) => {
  const router = useRouter();
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);
  const url = buildWorkspaceApiPath({
    context: routeContext,
    teamSlug: slug,
    suffix: 'webhooks',
  });

  const { data, error, isLoading } = useSWR<ApiResponse<EndpointOut[]>>(
    slug && url ? url : null,
    fetcher
  );

  const mutateWebhooks = async () => {
    if (url) {
      mutate(url);
    }
  };

  return {
    isLoading,
    isError: error,
    webhooks: data?.data,
    mutateWebhooks,
  };
};

export default useWebhooks;
