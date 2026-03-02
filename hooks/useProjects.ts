import fetcher from '@/lib/fetcher';
import useSWR, { mutate } from 'swr';
import type { ApiResponse, ProjectWithMemberCount } from 'types';

const useProjects = () => {
  const url = `/api/orgs`;

  const { data, error, isLoading } = useSWR<
    ApiResponse<ProjectWithMemberCount[]>
  >(url, fetcher);

  const mutateProjects = async () => {
    mutate(url);
  };

  return {
    isLoading,
    isError: error,
    projects: data?.data,
    mutateProjects,
  };
};

export default useProjects;
