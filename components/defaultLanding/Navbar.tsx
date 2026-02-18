import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import useTheme from 'hooks/useTheme';
import env from '@/lib/env';
import UserDropdown from '../shared/shell/UserDropdown';
import LanguageSwitcher from '../shared/shell/LanguageSwitcher';

const Navbar = () => {
  const { toggleTheme, selectedTheme } = useTheme();
  const { t } = useTranslation('common');
  const { status, data: session } = useSession();

  return (
    <div className="navbar bg-base-100 px-4">
      {/* Logo - Sola Hizalı */}
      <div className="navbar-start">
        <Link href="/" className="btn btn-ghost text-xl normal-case px-0">
          BoxyHQ
        </Link>
      </div>

      {/* Linkler - Ortaya Hizalı */}
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal p-0">
          <li>
            <Link
              href="/pricing"
              className="text-sm font-semibold transition-colors hover:text-primary leading-6 text-gray-900 dark:text-gray-50"
            >
              {t('pricing')}
            </Link>
          </li>
        </ul>
      </div>

      {/* Araçlar - Sağa Hizalı */}
      <div className="navbar-end gap-2">
        <LanguageSwitcher />
        {env.darkModeEnabled && (
          <button
            className="btn btn-ghost btn-circle btn-sm flex items-center justify-center p-0"
            onClick={toggleTheme}
          >
            <selectedTheme.icon className="w-5 h-5" />
          </button>
        )}

        {status === 'authenticated' && session?.user ? (
          <UserDropdown user={session.user} />
        ) : (
          status !== 'loading' && (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="btn btn-ghost btn-sm normal-case"
              >
                {t('sign-in')}
              </Link>
              <Link
                href="/auth/join"
                className="btn btn-primary btn-sm normal-case text-white"
              >
                {t('sign-up')}
              </Link>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default Navbar;
