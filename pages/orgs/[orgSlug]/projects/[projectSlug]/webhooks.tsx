import WebhooksPage from '@/modules/workspace/pages/webhooks';
import { getWorkspacePageServerSideProps } from '@/modules/workspace/pages/org-project-server-props';

export const getServerSideProps = getWorkspacePageServerSideProps('webhooks');

export default WebhooksPage;
