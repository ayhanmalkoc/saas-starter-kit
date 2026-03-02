import APIKeysPage from '@/modules/workspace/pages/api-keys';
import { getWorkspacePageServerSideProps } from '@/modules/workspace/pages/org-project-server-props';

export const getServerSideProps = getWorkspacePageServerSideProps('api-keys');

export default APIKeysPage;
