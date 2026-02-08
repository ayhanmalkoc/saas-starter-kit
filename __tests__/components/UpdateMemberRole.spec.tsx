import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AccessControl } from '@/components/shared/AccessControl';
import UpdateMemberRole from '@/components/team/UpdateMemberRole';

jest.mock('next-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('hooks/useCanAccess', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseCanAccess = jest.requireMock('hooks/useCanAccess')
  .default as jest.Mock;
const toast = jest.requireMock('react-hot-toast').default as {
  success: jest.Mock;
  error: jest.Mock;
};

describe('UpdateMemberRole', () => {
  const team = { slug: 'alpha-team' } as any;
  const member = { userId: 'user-1', role: 'MEMBER' } as any;

  beforeEach(() => {
    (global.fetch as jest.Mock) = jest.fn();
    jest.clearAllMocks();
    mockedUseCanAccess.mockReturnValue({
      canAccess: () => true,
      isLoading: false,
      isError: null,
    });
  });

  it('renders role selector and updates role', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });

    render(<UpdateMemberRole team={team} member={member} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    await userEvent.selectOptions(select, 'ADMIN');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/teams/alpha-team/members',
        expect.objectContaining({ method: 'PATCH' })
      );
      expect(toast.success).toHaveBeenCalledWith('member-role-updated');
    });
  });

  it('shows error toast when role update fails (validation/permission)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'not allowed to update role' } }),
    });

    render(<UpdateMemberRole team={team} member={member} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'OWNER');

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('not allowed to update role');
    });
  });

  it('hides role selector when wrapped with denied AccessControl', () => {
    mockedUseCanAccess.mockReturnValue({
      canAccess: () => false,
      isLoading: false,
      isError: null,
    });

    render(
      <AccessControl resource="team_member" actions={['update']}>
        <UpdateMemberRole team={team} member={member} />
      </AccessControl>
    );

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
