import ProductsPage from '@/modules/workspace/pages/products';
import { getWorkspacePageServerSideProps } from '@/modules/workspace/pages/org-project-server-props';

export const getServerSideProps = getWorkspacePageServerSideProps('products');

export default ProductsPage;
