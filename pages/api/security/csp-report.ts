import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const report = req.body?.['csp-report'] ?? req.body;

  console.warn('CSP violation report', report);

  return res.status(204).end();
}
