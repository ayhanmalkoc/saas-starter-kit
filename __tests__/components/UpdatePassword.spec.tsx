import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import UpdatePassword from '@/components/account/UpdatePassword';

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

const toast = jest.requireMock('react-hot-toast').default as {
  success: jest.Mock;
  error: jest.Mock;
};

describe('UpdatePassword', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock) = jest.fn();
    jest.clearAllMocks();
  });

  it('renders and updates password successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    render(<UpdatePassword />);

    const submitButton = screen.getByRole('button', {
      name: 'change-password',
    });
    const currentPasswordInput =
      screen.getByPlaceholderText('current-password');
    const newPasswordInput = screen.getByPlaceholderText('new-password');

    await userEvent.type(currentPasswordInput, 'current-password-123');
    await userEvent.type(newPasswordInput, 'new-password-123');

    expect(submitButton).toBeEnabled();
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/password',
        expect.anything()
      );
      expect(toast.success).toHaveBeenCalledWith('successfully-updated');
    });
  });

  it('prevents submit when new password is too short (validation)', async () => {
    render(<UpdatePassword />);

    const newPasswordInput = screen.getByPlaceholderText('new-password');
    const submitButton = screen.getByRole('button', {
      name: 'change-password',
    });

    await userEvent.type(newPasswordInput, '123');
    fireEvent.blur(newPasswordInput);

    await waitFor(() => expect(submitButton).toBeDisabled());
  });

  it('shows server error when update fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'invalid current password' } }),
    });

    render(<UpdatePassword />);

    await userEvent.type(
      screen.getByPlaceholderText('current-password'),
      'wrong-password'
    );
    await userEvent.type(
      screen.getByPlaceholderText('new-password'),
      'new-password-123'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'change-password' })
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('invalid current password');
    });
  });
});
