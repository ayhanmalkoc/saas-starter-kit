import { sendAudit } from '@/lib/retraced';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
    } catch (e: any) {
      console.error('❌ Valid User: Failed', e);
      return res
        .status(500)
        .json({ error: 'Valid user failed', details: e.message });
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
    } catch (e: any) {
      console.error('❌ Null Name User: Failed', e);
      return res
        .status(500)
        .json({ error: 'Null name user failed', details: e.message });
    }

    res.status(200).json({ success: true, message: 'All audit tests passed' });
  } catch (error: any) {
    console.error('Global Error in Debug Sync:', error);
    res.status(500).json({ error: error.message });
  }
}
