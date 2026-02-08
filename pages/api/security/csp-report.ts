import type { NextApiRequest, NextApiResponse } from 'next';

const ACCEPTED_CONTENT_TYPES = new Set([
  'application/csp-report',
  'application/reports+json',
  'application/json',
]);

const MAX_BODY_BYTES = 64 * 1024;
const MAX_FIELD_LENGTH = 512;

type CspReportPayload = {
  'document-uri': string;
  'violated-directive': string;
  'blocked-uri': string;
  'effective-directive'?: string;
  'original-policy'?: string;
  'disposition'?: string;
  'line-number'?: number;
  'column-number'?: number;
  'source-file'?: string;
  'status-code'?: number;
};

const sanitizeString = (value: unknown, maxLength = MAX_FIELD_LENGTH) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, maxLength);
};

const toNumberIfFinite = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return undefined;
};

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeReport = (payload: unknown): unknown => {
  if (Array.isArray(payload)) {
    return payload[0] ?? null;
  }

  return payload;
};

const validateAndSanitizeReport = (
  payload: unknown
): CspReportPayload | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const report = payload as Record<string, unknown>;
  const documentUri = sanitizeString(report['document-uri']);
  const violatedDirective = sanitizeString(report['violated-directive']);
  const blockedUri = sanitizeString(report['blocked-uri']);

  if (!documentUri || !violatedDirective || !blockedUri) {
    return null;
  }

  return {
    'document-uri': documentUri,
    'violated-directive': violatedDirective,
    'blocked-uri': blockedUri,
    'effective-directive': sanitizeString(report['effective-directive']),
    disposition: sanitizeString(report.disposition),
    'original-policy': sanitizeString(report['original-policy'], 2048),
    'source-file': sanitizeString(report['source-file']),
    'line-number': toNumberIfFinite(report['line-number']),
    'column-number': toNumberIfFinite(report['column-number']),
    'status-code': toNumberIfFinite(report['status-code']),
  };
};

const readRawBody = async (req: NextApiRequest): Promise<string> => {
  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of req) {
    const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalSize += chunkBuffer.length;

    if (totalSize > MAX_BODY_BYTES) {
      return '';
    }

    chunks.push(chunkBuffer);
  }

  return Buffer.concat(chunks).toString('utf8');
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const contentType = (req.headers['content-type'] || '').split(';')[0].trim();

  if (contentType && !ACCEPTED_CONTENT_TYPES.has(contentType)) {
    return res.status(204).end();
  }

  const rawBody = await readRawBody(req);

  if (!rawBody) {
    return res.status(204).end();
  }

  const parsedBody = parseJson(rawBody);
  const normalizedPayload = normalizeReport(parsedBody);
  const candidateReport =
    (normalizedPayload as Record<string, unknown>)?.['csp-report'] ??
    normalizedPayload;
  const report = validateAndSanitizeReport(candidateReport);

  if (!report) {
    return res.status(204).end();
  }

  console.warn('CSP violation report', report);

  return res.status(204).end();
}
