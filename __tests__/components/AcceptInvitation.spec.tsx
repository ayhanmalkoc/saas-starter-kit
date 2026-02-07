import "@testing-library/jest-dom";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AccessControl } from '@/components/shared/AccessControl';
import AcceptInvitation from '@/components/invitation/AcceptInvitation';

const push = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('next-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

jest.mock('hooks/useCanAccess', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseCanAccess = jest.requireMock('hooks/useCanAccess').default as jest.Mock;
const toast = jest.requireMock('react-hot-toast').default as {
  error: jest.Mock;
};

describe('AcceptInvitation', () => {
  const invitation = {
    token: 'invite-token',
    team: { slug: 'alpha-team' },
  } as any;

  beforeEach(() => {
    (global.fetch as jest.Mock) = jest.fn();
    jest.clearAllMocks();
    mockedUseCanAccess.mockReturnValue({
      canAccess: () => true,
      isLoading: false,
      isError: null,
    });
  });

  it('renders CTA and redirects to dashboard when invitation is accepted', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    render(<AcceptInvitation invitation={invitation} />);

    const cta = screen.getByRole('button', { name: 'accept-invitation' });
    expect(cta).toBeInTheDocument();

    await userEvent.click(cta);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/teams/alpha-team/invitations',
        expect.objectContaining({ method: 'PUT' })
      );
      expect(push).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows API error if accept invitation fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'invalid invitation' } }),
    });

    render(<AcceptInvitation invitation={invitation} />);

    await userEvent.click(screen.getByRole('button', { name: 'accept-invitation' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('invalid invitation');
      expect(push).not.toHaveBeenCalled();
    });
  });

  it('hides accept CTA when wrapped with denied AccessControl', () => {
    mockedUseCanAccess.mockReturnValue({
      canAccess: () => false,
      isLoading: false,
      isError: null,
    });

    render(
      <AccessControl resource="team_invitation" actions={['create']}>
        <AcceptInvitation invitation={invitation} />
      </AccessControl>
    );

    expect(screen.queryByRole('button', { name: 'accept-invitation' })).not.toBeInTheDocument();
  });
});
