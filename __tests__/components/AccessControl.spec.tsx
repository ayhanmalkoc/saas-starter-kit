import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { AccessControl } from '@/components/shared/AccessControl';

jest.mock('hooks/useCanAccess', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseCanAccess = jest.requireMock('hooks/useCanAccess')
  .default as jest.Mock;

describe('AccessControl', () => {
  const visibleLabel = 'cta-visible';
  const hiddenLabel = 'cta-hidden';

  it('renders children when permission exists', () => {
    mockedUseCanAccess.mockReturnValue({
      canAccess: () => true,
      isLoading: false,
      isError: null,
    });

    render(
      <AccessControl resource="team_member" actions={['read']}>
        <button>{visibleLabel}</button>
      </AccessControl>
    );

    expect(
      screen.getByRole('button', { name: visibleLabel })
    ).toBeInTheDocument();
  });

  it('hides children when permission does not exist', () => {
    mockedUseCanAccess.mockReturnValue({
      canAccess: () => false,
      isLoading: false,
      isError: null,
    });

    render(
      <AccessControl resource="team_member" actions={['update']}>
        <button>{hiddenLabel}</button>
      </AccessControl>
    );

    expect(
      screen.queryByRole('button', { name: hiddenLabel })
    ).not.toBeInTheDocument();
  });
});
