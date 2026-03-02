import fetcher from '@/lib/fetcher';
import {
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import { useRouter } from 'next/router';
import type { EndpointOut } from 'svix';
import useSWR, { mutate } from 'swr';
import type { ApiResponse } from 'types';

const useWebhook = (endpointId: string | null) => {
  const router = useRouter();
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);
  const url = buildWorkspaceApiPath({
    context: routeContext,
    suffix: endpointId ? `webhooks/${endpointId}` : undefined,
  });

  const { data, error, isLoading } = useSWR<ApiResponse<EndpointOut>>(
    url,
    fetcher
  );

  const mutateWebhook = async () => {
    if (url) {
      mutate(url);
    }
  };

  return {
    isLoading,
    isError: error,
    webhook: data?.data,
    mutateWebhook,
  };
};

export default useWebhook;
