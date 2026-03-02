import DirectorySyncPage from '@/modules/workspace/pages/directory-sync';
import { getWorkspacePageServerSideProps } from '@/modules/workspace/pages/org-project-server-props';

export const getServerSideProps =
  getWorkspacePageServerSideProps('directory-sync');

export default DirectorySyncPage;
