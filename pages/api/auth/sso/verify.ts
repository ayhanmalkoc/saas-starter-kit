import env from '@/lib/env';
import { ssoManager } from '@/lib/jackson/sso';
import { ssoVerifySchema, validateWithSchema } from '@/lib/zod';
import { Project } from '@prisma/client';
import { getProjectBySlug, getProjectsByUserId } from 'models/project';
import { getUser } from 'models/user';
import { NextApiRequest, NextApiResponse } from 'next';

const sso = ssoManager();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        await handlePOST(req, res);
        break;
      default:
        res.setHeader('Allow', 'POST');
        res.status(405).json({
          error: { message: `Method ${method} Not Allowed` },
        });
    }
  } catch (err: any) {
    res.status(400).json({
      error: { message: err.message },
    });
  }
}

const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  const { projectSlug, email } = validateWithSchema(
    ssoVerifySchema,
    JSON.parse(req.body) as { projectSlug: string }
  );

  if (!projectSlug && !email) {
    return res.status(400).json({ error: 'Invalid request.' });
  }

  // If project slug is provided, verify SSO connections for the project.
  if (projectSlug) {
    const project = await getProjectBySlug(projectSlug);

    if (!project) {
      throw new Error('Project not found.');
    }

    const data = await handleProjectSSOVerification(project.id);
    return res.json({ data });
  }

  // If email is provided, verify SSO connections for the user
  if (email) {
    const projects = await getProjectsFromEmail(email);

    if (projects.length === 1) {
      const data = await handleProjectSSOVerification(projects[0].id);
      return res.json({ data });
    }

    const { projectId, useProjectSlug } =
      await processProjectsForSSOVerification(projects);

    // Multiple projects with SSO connections found
    // Ask user to provide project slug.
    if (useProjectSlug) {
      return res.json({
        data: {
          useProjectSlug,
        },
      });
    }

    // No projects with SSO connections found
    if (!projectId) {
      throw new Error('No SSO connections found for any project.');
    } else {
      // Only one project with SSO connections found
      return res.json({
        data: {
          projectId,
        },
      });
    }
  }
};

/**
 * Handle SSO verification for given project id
 */
async function handleProjectSSOVerification(projectId: string) {
  const exists = await projectSSOExists(projectId);

  if (!exists) {
    throw new Error('No SSO connections found for this project.');
  }

  return { projectId };
}

/**
 * Get list of projects for a user from email
 */
async function getProjectsFromEmail(email: string): Promise<Project[]> {
  const user = await getUser({ email });
  if (!user) {
    throw new Error('User not found.');
  }
  const projects = await getProjectsByUserId(user.id);
  if (!projects.length) {
    throw new Error('User does not belong to any project.');
  }
  return projects;
}

/**
 * Check if SSO connections exist for a project
 */
async function projectSSOExists(projectId: string): Promise<boolean> {
  const connections = await sso.getConnections({
    tenant: projectId,
    product: env.jackson.productId,
  });

  if (connections && connections.length > 0) {
    return true;
  }

  return false;
}

/**
 * Process projects to find the project with SSO connections
 * If multiple projects with SSO connections are found, return useProjectSlug as true
 * If no projects with SSO connections are found, return projectId as empty string
 * If only one project with SSO connections is found, return projectId
 */
async function processProjectsForSSOVerification(projects: Project[]): Promise<{
  projectId: string;
  useProjectSlug: boolean;
}> {
  let projectId = '';
  for (const project of projects) {
    const exists = await projectSSOExists(project.id);

    if (exists) {
      if (projectId) {
        // Multiple projects with SSO connections found
        return {
          projectId: '',
          useProjectSlug: true,
        };
      } else {
        // First project with SSO connections found
        projectId = project.id;
      }
    }
  }
  return {
    projectId,
    useProjectSlug: false,
  };
}
