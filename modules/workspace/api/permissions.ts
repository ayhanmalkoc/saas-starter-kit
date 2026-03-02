import { permissions } from '@/lib/permissions';
import { throwIfNoProjectAccess } from 'models/access';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    switch (req.method) {
      case 'GET':
        await handleGET(req, res);
        break;
      default:
        res.setHeader('Allow', 'GET');
        res.status(405).json({
          error: { message: `Method ${req.method} Not Allowed` },
        });
    }
  } catch (error: any) {
    const message = error.message || 'Something went wrong';
    const status = error.status || 500;

    res.status(status).json({ error: { message } });
  }
}

// Get permissions for a project for the current user
const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectRole = await throwIfNoProjectAccess(req, res);

  res.json({ data: permissions[projectRole.role] });
};
