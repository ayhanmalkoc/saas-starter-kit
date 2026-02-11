import Link from 'next/link';
import { useTranslation } from 'next-i18next';

const Footer = () => {
  const { t } = useTranslation('common');

  return (
    <footer className="footer items-center p-4 bg-neutral text-neutral-content">
      <div className="items-center grid-flow-col">
        <p>Copyright © {new Date().getFullYear()} - All right reserved</p>
      </div>
      <div className="grid-flow-col gap-4 md:place-self-center md:justify-self-end">
        <Link href="/privacy" className="link link-hover">
          {t('privacy-policy')}
        </Link>
        <Link href="/terms" className="link link-hover">
          {t('terms-of-service')}
        </Link>
      </div>
    </footer>
  );
};

export default Footer;
