import { test as base } from '@playwright/test';
import { user, project } from '../support/helper';
import { JoinPage, LoginPage, SettingsPage } from '../support/fixtures';
import { prisma } from '@/lib/prisma';

const teamNewInfo = {
  name: 'New Project Name',
  slug: 'new-project-example',
  sluggified: 'new-project-example',
} as const;

type ProjectSettingsFixture = {
  loginPage: LoginPage;
  joinPage: JoinPage;
  settingsPage: SettingsPage;
};

const test = base.extend<ProjectSettingsFixture>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(loginPage);
  },
  joinPage: async ({ page }, use) => {
    const joinPage = new JoinPage(page, user, project.name);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(joinPage);
  },
  settingsPage: async ({ page }, use) => {
    const settingsPage = new SettingsPage(page, project.slug);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(settingsPage);
  },
});

const resetDefaultProjectState = async () => {
  const organization = await prisma.organization.findUnique({
    where: { slug: project.slug },
    select: { id: true },
  });

  if (!organization) {
    return;
  }

  await prisma.project.updateMany({
    where: {
      organizationId: organization.id,
      slug: teamNewInfo.sluggified,
    },
    data: { name: project.name, slug: 'default' },
  });

  await prisma.project.updateMany({
    where: {
      organizationId: organization.id,
      slug: 'default',
    },
    data: { name: project.name },
  });
};

test.beforeEach(async () => {
  await resetDefaultProjectState();
});

test.afterAll(async () => {
  await resetDefaultProjectState();
});

test('Should be able to update project name', async ({
  loginPage,
  settingsPage,
}) => {
  await loginPage.goto();
  await loginPage.credentialLogin(user.email, user.password);
  await loginPage.loggedInCheck(project.slug);

  await settingsPage.goto(project.slug);
  await settingsPage.updateTeamName(teamNewInfo.name);

  await settingsPage.page.reload();
  await settingsPage.isSettingsPageVisible();
  await settingsPage.checkTeamName(teamNewInfo.name);
});

test('Should not allow to update project name with empty value', async ({
  loginPage,
  settingsPage,
}) => {
  await loginPage.goto();
  await loginPage.credentialLogin(user.email, user.password);
  await loginPage.loggedInCheck(project.slug);

  await settingsPage.goto(project.slug);
  await settingsPage.fillTeamName('');
  await settingsPage.isSaveButtonDisabled();
});

test('Should not allow to update project name with more than 50 characters', async ({
  loginPage,
  settingsPage,
}) => {
  await loginPage.goto();
  await loginPage.credentialLogin(user.email, user.password);
  await loginPage.loggedInCheck(project.slug);

  await settingsPage.goto(project.slug);
  await settingsPage.fillTeamName('a'.repeat(51));
  await settingsPage.isSaveButtonDisabled();
  await settingsPage.isTeamNameLengthErrorVisible();
});

test('Should be able to update project slug', async ({
  loginPage,
  settingsPage,
}) => {
  await loginPage.goto();
  await loginPage.credentialLogin(user.email, user.password);
  await loginPage.loggedInCheck(project.slug);

  await settingsPage.goto(project.slug);
  await settingsPage.updateTeamSlug(teamNewInfo.slug);

  await settingsPage.isSettingsPageVisible();
  await settingsPage.checkTeamSlug(teamNewInfo.sluggified);

  // Keep tests isolated: revert slug so later specs don't depend on prior state.
  await settingsPage.updateTeamSlug('default');
  await settingsPage.checkTeamSlug('default');
});

test('Should not allow empty slug', async ({ loginPage, settingsPage }) => {
  await loginPage.goto();
  await loginPage.credentialLogin(user.email, user.password);
  await loginPage.loggedInCheck(project.slug);

  await settingsPage.goto(project.slug);
  await settingsPage.fillTeamSlug('');
  await settingsPage.isSaveButtonDisabled();
});

test('Should not allow to update project slug with more than 50 characters', async ({
  loginPage,
  settingsPage,
}) => {
  await loginPage.goto();
  await loginPage.credentialLogin(user.email, user.password);
  await loginPage.loggedInCheck(project.slug);

  await settingsPage.goto(project.slug);
  await settingsPage.fillTeamSlug('a'.repeat(51));
  await settingsPage.isSaveButtonDisabled();
  await settingsPage.isTeamSlugLengthErrorVisible();
});

test('Should be able to set domain in project settings', async ({
  loginPage,
  settingsPage,
}) => {
  await loginPage.goto();
  await loginPage.credentialLogin(user.email, user.password);
  await loginPage.loggedInCheck(project.slug);

  await settingsPage.goto(project.slug);
  await settingsPage.updateDomain('example.com');
});

test('Should not allow to set domain with more than 253 characters', async ({
  loginPage,
  settingsPage,
}) => {
  await loginPage.goto();
  await loginPage.credentialLogin(user.email, user.password);
  await loginPage.loggedInCheck(project.slug);

  await settingsPage.goto(project.slug);
  await settingsPage.fillDomain('a'.repeat(256) + '.com');
  await settingsPage.isSaveButtonDisabled();
  await settingsPage.isDomainLengthErrorVisible();
});

test('Should not allow to set invalid domain', async ({
  loginPage,
  settingsPage,
}) => {
  await loginPage.goto();
  await loginPage.credentialLogin(user.email, user.password);
  await loginPage.loggedInCheck(project.slug);

  await settingsPage.goto(project.slug);
  await settingsPage.fillDomain('example');
  await settingsPage.isSaveButtonDisabled();
  await settingsPage.isDomainInvalidErrorVisible();
});
