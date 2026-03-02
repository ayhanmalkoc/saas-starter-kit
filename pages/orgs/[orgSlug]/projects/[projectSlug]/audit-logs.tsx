import AuditLogsPage from '@/modules/workspace/pages/audit-logs';
import { getWorkspacePageServerSideProps } from '@/modules/workspace/pages/org-project-server-props';

export const getServerSideProps = getWorkspacePageServerSideProps('audit-logs');

export default AuditLogsPage;
