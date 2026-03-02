import SSOPage from '@/modules/workspace/pages/sso';
import { getWorkspacePageServerSideProps } from '@/modules/workspace/pages/org-project-server-props';

export const getServerSideProps = getWorkspacePageServerSideProps('sso');

export default SSOPage;
