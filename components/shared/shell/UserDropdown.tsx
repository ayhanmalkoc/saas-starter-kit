import Link from 'next/link';
import React from 'react';
import {
  ArrowLeftStartOnRectangleIcon,
  SunIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import useTheme from 'hooks/useTheme';
import env from '@/lib/env';
import { useTranslation } from 'next-i18next';
import { useCustomSignOut } from 'hooks/useCustomSignout';
import LetterAvatar from '../LetterAvatar';
import Image from 'next/image';

interface UserDropdownProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

const UserDropdown = ({ user }: UserDropdownProps) => {
  const { toggleTheme } = useTheme();
  const { t } = useTranslation('common');
  const signOut = useCustomSignOut();

  return (
    <div className="dropdown dropdown-end">
      <div className="flex items-center cursor-pointer" tabIndex={0}>
        <div className="avatar">
          <div className="w-8 rounded-full">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || 'User'}
                width={32}
                height={32}
              />
            ) : (
              <LetterAvatar name={user.name || user.email || 'U'} />
            )}
          </div>
        </div>
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content z-[20] menu p-2 shadow bg-base-100 border rounded w-40 space-y-1 mt-1"
      >
        <li
          onClick={() => {
            if (document.activeElement) {
              (document.activeElement as HTMLElement).blur();
            }
          }}
        >
          <Link
            href="/settings/account"
            className="block px-2 py-1 text-sm leading-6 text-gray-900 dark:text-gray-50 cursor-pointer"
          >
            <div className="flex items-center text-sm font-semibold leading-6">
              <UserCircleIcon className="w-5 h-5 mr-1" /> {t('account')}
            </div>
          </Link>
        </li>

        {env.darkModeEnabled && (
          <li>
            <button
              className="block px-2 py-1 text-sm leading-6 text-gray-900 dark:text-gray-50 cursor-pointer"
              type="button"
              onClick={toggleTheme}
            >
              <div className="flex items-center text-sm font-semibold leading-6">
                <SunIcon className="w-5 h-5 mr-1" /> {t('switch-theme')}
              </div>
            </button>
          </li>
        )}

        <li>
          <button
            className="block px-2 py-1 text-sm leading-6 text-gray-900 dark:text-gray-50 cursor-pointer"
            type="button"
            onClick={signOut}
          >
            <div className="flex items-center text-sm font-semibold leading-6">
              <ArrowLeftStartOnRectangleIcon className="w-5 h-5 mr-1" />{' '}
              {t('logout')}
            </div>
          </button>
        </li>
      </ul>
    </div>
  );
};

export default UserDropdown;
