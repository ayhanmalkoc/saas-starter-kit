import useSWR, { mutate } from 'swr';

import fetcher from '@/lib/fetcher';
import {
  buildWorkspaceApiPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import { useRouter } from 'next/router';
import type { ApiResponse } from 'types';
import { TeamInvitation } from 'models/invitation';

interface Props {
  slug: string;
  sentViaEmail: boolean;
}

const useInvitations = ({ slug, sentViaEmail }: Props) => {
  const router = useRouter();
  const routeContext = getWorkspaceRouteContextFromQuery(router.query);
  const baseUrl = buildWorkspaceApiPath({
    context: routeContext,
    teamSlug: slug,
    suffix: 'invitations',
  });
  const url =
    baseUrl === null ? null : `${baseUrl}?sentViaEmail=${sentViaEmail}`;

  const { data, error, isLoading } = useSWR<ApiResponse<TeamInvitation[]>>(
    url,
    fetcher
  );

  const mutateInvitation = async () => {
    if (url) {
      mutate(url);
    }
  };

  return {
    isLoading,
    isError: error,
    invitations: data?.data,
    mutateInvitation,
  };
};

export default useInvitations;
