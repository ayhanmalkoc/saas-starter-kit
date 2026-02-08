import '@testing-library/jest-dom';
import { renderHook } from '@testing-library/react';

import useCanAccess from '@/hooks/useCanAccess';

jest.mock('@/hooks/usePermissions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUsePermissions = jest.requireMock('@/hooks/usePermissions')
  .default as jest.Mock;

describe('useCanAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows access when matching action exists', () => {
    mockedUsePermissions.mockReturnValue({
      permissions: [{ resource: 'team_member', actions: ['update'] }],
      isError: null,
      isLoading: false,
    });

    const { result } = renderHook(() => useCanAccess());

    expect(result.current.canAccess('team_member', ['update'])).toBe(true);
    expect(result.current.canAccess('team_member', ['delete'])).toBe(false);
  });

  it('allows access when action wildcard exists', () => {
    mockedUsePermissions.mockReturnValue({
      permissions: [{ resource: 'team', actions: '*' }],
      isError: null,
      isLoading: false,
    });

    const { result } = renderHook(() => useCanAccess());

    expect(result.current.canAccess('team', ['delete'])).toBe(true);
    expect(result.current.canAccess('team_member', ['read'])).toBe(false);
  });

  it('returns false when permissions are missing (no-authority case)', () => {
    mockedUsePermissions.mockReturnValue({
      permissions: undefined,
      isError: null,
      isLoading: false,
    });

    const { result } = renderHook(() => useCanAccess());

    expect(result.current.canAccess('team_invitation', ['create'])).toBe(false);
  });
});
