import fetcher from '@/lib/fetcher';
import type { Permission } from '@/lib/permissions';
import {
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import type { ApiResponse } from 'types';

const usePermissions = () => {
  const router = useRouter();
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);
  const url = router.isReady
    ? buildWorkspaceApiPath({
        context: routeContext,
        suffix: 'permissions',
      })
    : null;

  const { data, error, isLoading } = useSWR<ApiResponse<Permission[]>>(
    url,
    fetcher
  );

  return {
    isLoading,
    isError: error,
    permissions: data?.data,
  };
};

export default usePermissions;
