import type { NextPageWithLayout } from 'types';
import { useTranslation } from 'next-i18next';

const Products: NextPageWithLayout = () => {
  const { t } = useTranslation('common');

  return (
    <div className="p-3">
      <p className="text-sm">{t('product-placeholder')}</p>
    </div>
  );
};

export default Products;
