import { updateUser } from 'models/user';
import {
  deleteVerificationToken,
  getVerificationToken,
} from 'models/verificationToken';
import type { GetServerSidePropsContext } from 'next';
import type { ReactElement } from 'react';
import { isValidCallbackUrl } from '@/lib/email/urlUtils';

const VerifyEmailToken = () => {
  return <></>;
};

VerifyEmailToken.getLayout = function getLayout(page: ReactElement) {
  return <>{page}</>;
};

export const getServerSideProps = async ({
  query,
}: GetServerSidePropsContext) => {
  const { token, callbackUrl } = query as {
    token: string;
    callbackUrl?: string;
  };

  if (!token) {
    return {
      notFound: true,
    };
  }

  const verificationToken = await getVerificationToken(token);

  if (!verificationToken) {
    return {
      redirect: {
        destination: '/auth/login?error=token-not-found',
        permanent: false,
      },
    };
  }

  if (new Date() > verificationToken.expires) {
    return {
      redirect: {
        destination: '/auth/resend-email-token?error=verify-account-expired',
        permanent: false,
      },
    };
  }

  try {
    await updateUser({
      where: {
        email: verificationToken.identifier,
      },
      data: {
        emailVerified: new Date(),
      },
    });
  } catch {
    return {
      redirect: {
        destination: '/auth/login?error=verify-email-failed',
        permanent: false,
      },
    };
  }

  try {
    await deleteVerificationToken(verificationToken.token);
  } catch (error) {
    console.error('Failed to delete email verification token', error);
  }

  const safeCallbackUrl =
    callbackUrl && isValidCallbackUrl(callbackUrl) ? callbackUrl : undefined;

  return {
    redirect: {
      destination: `/auth/login?success=email-verified${
        safeCallbackUrl
          ? `&callbackUrl=${encodeURIComponent(safeCallbackUrl)}`
          : ''
      }`,
      permanent: false,
    },
  };
};

export default VerifyEmailToken;
