import MembersPage from '@/modules/workspace/pages/members';
import { getWorkspacePageServerSideProps } from '@/modules/workspace/pages/org-project-server-props';

export const getServerSideProps = getWorkspacePageServerSideProps('members');

export default MembersPage;
