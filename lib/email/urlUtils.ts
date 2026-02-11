import env from '../env';

/**
 * Validates if a callbackUrl is safe to redirect to.
 * Safe URLs are:
 * 1. Relative paths starting with / (e.g. /dashboard)
 * 2. Absolute URLs matching the APP_URL origin
 */
export const isValidCallbackUrl = (
  callbackUrl: string | undefined
): boolean => {
  if (!callbackUrl) {
    return true;
  }

  // 1. Check if it's a relative path
  if (callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')) {
    return true;
  }

  // 2. Check if it's an absolute URL and matches APP_URL origin
  try {
    const url = new URL(callbackUrl);
    const appUrl = new URL(env.appUrl);
    return url.origin === appUrl.origin;
  } catch {
    return false;
  }
};
