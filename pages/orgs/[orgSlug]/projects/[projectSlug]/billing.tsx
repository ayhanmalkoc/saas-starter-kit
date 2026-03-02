import BillingPage from '@/modules/workspace/pages/billing';
import { getWorkspacePageServerSideProps } from '@/modules/workspace/pages/org-project-server-props';

export const getServerSideProps = getWorkspacePageServerSideProps('billing');

export default BillingPage;
