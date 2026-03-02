import SettingsPage from '@/modules/workspace/pages/settings';
import { getWorkspacePageServerSideProps } from '@/modules/workspace/pages/org-project-server-props';

export const getServerSideProps = getWorkspacePageServerSideProps('settings');

export default SettingsPage;
