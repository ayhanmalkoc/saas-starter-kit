import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { useRouter } from 'next/router';
import type { ApiResponse } from 'types';
import { Invitation, Project, Organization } from '@prisma/client';
import type { ProjectRouteTarget } from '@/lib/routing/workspace-routes';

export type InvitationWithProjectContext = Invitation & {
  project: Project &
    ProjectRouteTarget & {
      organization: Pick<Organization, 'id' | 'name' | 'slug'>;
    };
};

type Response = ApiResponse<InvitationWithProjectContext>;

const useInvitation = (token?: string) => {
  const { query, isReady } = useRouter();

  const { data, error, isLoading } = useSWR<Response>(() => {
    const inviteToken = token || (isReady ? query.token : null);
    return inviteToken ? `/api/invitations/${inviteToken}` : null;
  }, fetcher);

  return {
    isLoading,
    error,
    invitation: data?.data,
  };
};

export default useInvitation;
