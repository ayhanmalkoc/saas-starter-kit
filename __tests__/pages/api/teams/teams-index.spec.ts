import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/server-common', () => ({
  slugify: jest.fn((value: string) => value.toLowerCase().replace(/\s+/g, '-')),
}));

jest.mock('models/organization', () => ({
  createOrganizationWithDefaultProject: jest.fn(),
  getOrganizationBySlug: jest.fn(),
}));

jest.mock('models/project', () => ({
  getProjectsByUserId: jest.fn(),
}));

jest.mock('models/user', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/metrics', () => ({
  recordMetric: jest.fn(),
}));

jest.mock('@/lib/zod', () => ({
  createProjectSchema: {},
  validateWithSchema: jest.fn((_: unknown, payload: any) => payload),
}));

import handler from '@/pages/api/orgs/index';
import {
  createOrganizationWithDefaultProject,
  getOrganizationBySlug,
} from 'models/organization';
import { getProjectsByUserId } from 'models/project';
import { getCurrentUser } from 'models/user';
import { recordMetric } from '@/lib/metrics';

const createRes = () => {
  const res = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
  } as unknown as NextApiResponse;

  return res;
};

describe('/api/orgs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: 'user-1' });
  });

  it('returns 401 when user is unauthorized', async () => {
    (getCurrentUser as jest.Mock).mockRejectedValueOnce({
      status: 401,
      message: 'Unauthorized',
    });

    const req = { method: 'GET' } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: { message: 'Unauthorized' } });
  });

  it('returns 403 when role-based service denial is raised', async () => {
    (getProjectsByUserId as jest.Mock).mockRejectedValueOnce({
      status: 403,
      message: 'Forbidden',
    });

    const req = { method: 'GET' } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: { message: 'Forbidden' } });
  });

  it('GET returns projects and records metric', async () => {
    (getProjectsByUserId as jest.Mock).mockResolvedValueOnce([
      { id: 'project-1' },
    ]);

    const req = { method: 'GET' } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: [{ id: 'project-1' }] });
    expect(recordMetric).toHaveBeenCalledWith('project.fetched');
  });

  it('POST returns duplicate slug validation error', async () => {
    (getOrganizationBySlug as jest.Mock).mockResolvedValueOnce({
      id: 'org-1',
    });

    const req = {
      method: 'POST',
      body: { name: 'My Project' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: { message: 'An organization with this slug already exists.' },
    });
  });

  it('POST creates an organization/project and records metric', async () => {
    (getOrganizationBySlug as jest.Mock).mockResolvedValueOnce(null);
    (createOrganizationWithDefaultProject as jest.Mock).mockResolvedValueOnce({
      organization: {
        id: 'org-1',
        name: 'My Project',
        slug: 'my-project',
        billingId: null,
        billingProvider: null,
      },
      project: {
        id: 'project-1',
        name: 'My Project',
        slug: 'default',
      },
    });

    const req = {
      method: 'POST',
      body: { name: 'My Project' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(createOrganizationWithDefaultProject).toHaveBeenCalledWith({
      ownerUserId: 'user-1',
      organizationName: 'My Project',
      organizationSlug: 'my-project',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      data: {
        id: 'project-1',
        name: 'My Project',
        slug: 'default',
        organization: {
          id: 'org-1',
          name: 'My Project',
          slug: 'my-project',
          billingId: null,
          billingProvider: null,
        },
      },
    });
    expect(recordMetric).toHaveBeenCalledWith('project.created');
  });
});
