import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { GlobeAltIcon } from '@heroicons/react/24/outline';
import React from 'react';

const LanguageSwitcher = () => {
  const router = useRouter();
  useTranslation('common');

  const changeLanguage = (locale: string) => {
    router.push(router.asPath, router.asPath, { locale });
  };

  const languageNames: Record<string, string> = {
    en: 'English',
    tr: 'Türkçe',
  };

  return (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-circle btn-sm">
        <GlobeAltIcon className="w-5 h-5" />
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-32 mt-4"
      >
        {router.locales?.map((locale) => (
          <li key={locale}>
            <button
              onClick={() => changeLanguage(locale)}
              className={`${
                router.locale === locale ? 'active font-bold' : ''
              }`}
            >
              {languageNames[locale] || locale.toUpperCase()}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LanguageSwitcher;
