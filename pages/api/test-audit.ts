import { sendAudit } from '@/lib/retraced';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('--- Debug Audit: Starting ---');

    console.log('1. Testing with Valid User Name');
    // Mock data
    const validUser = {
      id: 'debug-user-1',
      name: 'Debug User',
      email: 'debug@example.com',
    };
    const team = {
      id: 'debug-team-1',
      name: 'Debug Team',
      slug: 'debug-team',
      domain: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Valid call
    try {
      await sendAudit({
        action: 'team.update',
        crud: 'u',
        user: validUser as any,
        team: team as any,
      });
      console.log('✅ Valid User: Sent successfully');
    } catch (error) {
      console.error('❌ Valid User: Failed', error);
      return res.status(500).json({ error: 'internal server error' });
    }

    console.log('2. Testing with NULL User Name');
    const nullNameUser = {
      id: 'debug-user-2',
      name: null,
      email: 'null@example.com',
    };

    // Null name call
    try {
      await sendAudit({
        action: 'team.update',
        crud: 'u',
        user: nullNameUser as any,
        team: team as any,
      });
      console.log('✅ Null Name User: Sent successfully');
    } catch (error) {
      console.error('❌ Null Name User: Failed', error);
      return res.status(500).json({ error: 'internal server error' });
    }

    return res
      .status(200)
      .json({ success: true, message: 'All audit tests passed' });
  } catch (error) {
    console.error('Global Error in Debug Sync:', error);
    return res.status(500).json({ error: 'internal server error' });
  }
}
