import React from 'react';
import { useSession } from 'next-auth/react';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';
import UserDropdown from './UserDropdown';

interface HeaderProps {
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Header = ({ setSidebarOpen }: HeaderProps) => {
  const { status, data } = useSession();
  const { t } = useTranslation('common');

  if (status === 'loading' || !data) {
    return null;
  }

  const { user } = data;

  return (
    <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b px-4 sm:gap-x-6 sm:px-6 lg:px-8 bg-white dark:bg-black dark:text-white">
      <button
        type="button"
        className="-m-2.5 p-2.5 text-gray-700 dark:text-gray-50 lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="sr-only">{t('open-sidebar')}</span>
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="relative flex flex-1"></div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <UserDropdown user={user} />
        </div>
      </div>
    </div>
  );
};

export default Header;
