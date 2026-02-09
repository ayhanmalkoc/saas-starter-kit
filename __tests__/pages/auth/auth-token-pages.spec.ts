import { getServerSideProps as getUnlockAccountProps } from '@/pages/auth/unlock-account';
import { getServerSideProps as getVerifyEmailTokenProps } from '@/pages/auth/verify-email-token';
import { unlockAccount } from '@/lib/accountLock';
import { updateUser, getUser } from 'models/user';
import {
  deleteVerificationToken,
  getVerificationToken,
  isVerificationTokenExpired,
} from 'models/verificationToken';

jest.mock('models/verificationToken', () => ({
  deleteVerificationToken: jest.fn(),
  getVerificationToken: jest.fn(),
  isVerificationTokenExpired: jest.fn(),
}));

jest.mock('models/user', () => ({
  getUser: jest.fn(),
  updateUser: jest.fn(),
}));

jest.mock('@/lib/accountLock', () => ({
  unlockAccount: jest.fn(),
}));

describe('auth token page redirects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not redirect unlock-account to success when unlock process fails', async () => {
    (getVerificationToken as jest.Mock).mockResolvedValue({
      identifier: 'locked@example.com',
      token: 'unlock-token',
      expires: new Date(Date.now() + 60_000),
    });
    (getUser as jest.Mock).mockResolvedValue({ id: 'user-1', email: 'locked@example.com' });
    (isVerificationTokenExpired as jest.Mock).mockReturnValue(false);
    (unlockAccount as jest.Mock).mockRejectedValue(new Error('unlock failed'));
    (deleteVerificationToken as jest.Mock).mockResolvedValue(undefined);

    const result = await getUnlockAccountProps({
      query: { token: 'unlock-token' },
    } as any);

    expect(result).toEqual({
      redirect: {
        destination: '/auth/login?error=unlock-failed',
        permanent: false,
      },
    });
  });

  it('does not redirect verify-email-token to success when verification process fails', async () => {
    (getVerificationToken as jest.Mock).mockResolvedValue({
      identifier: 'verify@example.com',
      token: 'verify-token',
      expires: new Date(Date.now() + 60_000),
    });
    (updateUser as jest.Mock).mockRejectedValue(new Error('update failed'));
    (deleteVerificationToken as jest.Mock).mockResolvedValue(undefined);

    const result = await getVerifyEmailTokenProps({
      query: { token: 'verify-token' },
    } as any);

    expect(result).toEqual({
      redirect: {
        destination: '/auth/login?error=verify-email-failed',
        permanent: false,
      },
    });
  });
});
