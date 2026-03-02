export type BillingScope = {
  organizationId: string;
  projectId?: string;
};

export const createBillingScope = ({
  organizationId,
  projectId,
}: {
  organizationId: string;
  projectId?: string;
}): BillingScope => ({
  organizationId,
  ...(projectId ? { projectId } : {}),
});
