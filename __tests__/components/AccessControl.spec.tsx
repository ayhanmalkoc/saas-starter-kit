import "@testing-library/jest-dom";
import { render, screen } from '@testing-library/react';

import { AccessControl } from '@/components/shared/AccessControl';

jest.mock('hooks/useCanAccess', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseCanAccess = jest.requireMock('hooks/useCanAccess').default as jest.Mock;

describe('AccessControl', () => {
  it('renders children when permission exists', () => {
    mockedUseCanAccess.mockReturnValue({
      canAccess: () => true,
      isLoading: false,
      isError: null,
    });

    render(
      <AccessControl resource="team_member" actions={['read']}>
        <button>cta-visible</button>
      </AccessControl>
    );

    expect(screen.getByRole('button', { name: 'cta-visible' })).toBeInTheDocument();
  });

  it('hides children when permission does not exist', () => {
    mockedUseCanAccess.mockReturnValue({
      canAccess: () => false,
      isLoading: false,
      isError: null,
    });

    render(
      <AccessControl resource="team_member" actions={['update']}>
        <button>cta-hidden</button>
      </AccessControl>
    );

    expect(screen.queryByRole('button', { name: 'cta-hidden' })).not.toBeInTheDocument();
  });
});
