import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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

    fireEvent.change(currentPasswordInput, {
      target: { value: 'current-password-123' },
    });
    fireEvent.change(newPasswordInput, {
      target: { value: 'new-password-123' },
    });

    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

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

    fireEvent.change(newPasswordInput, { target: { value: '123' } });
    fireEvent.blur(newPasswordInput);

    await waitFor(() => expect(submitButton).toBeDisabled());
  });

  it('shows server error when update fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'invalid current password' } }),
    });

    render(<UpdatePassword />);

    fireEvent.change(screen.getByPlaceholderText('current-password'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.change(screen.getByPlaceholderText('new-password'), {
      target: { value: 'new-password-123' },
    });

    const submitButton = screen.getByRole('button', {
      name: 'change-password',
    });
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('invalid current password');
    });
  });
});
