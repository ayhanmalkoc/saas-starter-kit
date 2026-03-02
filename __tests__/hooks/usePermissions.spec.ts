import '@testing-library/jest-dom';
import { renderHook } from '@testing-library/react';

import usePermissions from '@/hooks/usePermissions';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const useRouter = jest.requireMock('next/router').useRouter as jest.Mock;
const useSWR = jest.requireMock('swr').default as jest.Mock;

describe('usePermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns loading state until permissions are fetched', () => {
    useRouter.mockReturnValue({
      isReady: true,
      query: { orgSlug: 'acme-org', projectSlug: 'alpha-project' },
    });
    useSWR.mockReturnValue({ data: undefined, error: null, isLoading: true });

    const { result } = renderHook(() => usePermissions());

    expect(useSWR).toHaveBeenCalledWith(
      '/api/orgs/acme-org/projects/alpha-project/permissions',
      expect.any(Function)
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.permissions).toBeUndefined();
  });

  it('returns permissions from SWR response (role/permission variation)', () => {
    useRouter.mockReturnValue({
      isReady: true,
      query: { orgSlug: 'acme-org', projectSlug: 'alpha-project' },
    });
    useSWR.mockReturnValue({
      data: {
        data: [
          { resource: 'project_member', actions: ['read'] },
          { resource: 'project', actions: '*' },
        ],
      },
      error: null,
      isLoading: false,
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.permissions).toEqual([
      { resource: 'project_member', actions: ['read'] },
      { resource: 'project', actions: '*' },
    ]);
    expect(result.current.isError).toBeNull();
  });

  it('does not fetch when slug is missing', () => {
    useRouter.mockReturnValue({ isReady: true, query: {} });
    useSWR.mockReturnValue({ data: undefined, error: null, isLoading: false });

    renderHook(() => usePermissions());

    expect(useSWR).toHaveBeenCalledWith(null, expect.any(Function));
  });
});
