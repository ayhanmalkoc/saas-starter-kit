import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class SettingsPage {
  private readonly newProjectMenu: Locator;
  private readonly newProjectNameInput: Locator;
  private readonly createTeamDialogButton: Locator;
  private readonly removeTeamButton: Locator;
  private readonly removeTeamConfirmPrompt: Locator;
  private readonly updateTeamSuccessMessage: string;
  private readonly createTeamSuccessMessage: string;
  private readonly removeTeamSuccessMessage: string;
  private readonly deleteButton: Locator;

  constructor(
    public readonly page: Page,
    public readonly username: string
  ) {
    this.newProjectMenu = this.page.getByRole('link', { name: 'New Project' });
    this.newProjectNameInput = this.page.getByPlaceholder('Project Name');
    this.createTeamDialogButton = this.page
      .getByRole('dialog')
      .getByRole('button', { name: 'Create Project' });
    this.removeTeamButton = this.page.getByRole('button', {
      name: 'Remove Project',
    });
    this.removeTeamConfirmPrompt = this.page.getByText(
      `Are you sure you want to delete the project? Deleting the project will delete all resources and data associated with the project forever.`
    );
    this.updateTeamSuccessMessage = 'Changes saved successfully.';
    this.createTeamSuccessMessage = 'Project created successfully.';
    this.removeTeamSuccessMessage = 'Project removed successfully.';

    this.deleteButton = page.getByRole('button', { name: 'Delete' });
  }

  async logout() {
    await this.page
      .locator('button')
      .filter({ hasText: this.username })
      .click();
    await this.page.getByRole('button', { name: 'Sign out' }).click();
    await expect(
      this.page.getByRole('heading', { name: 'Welcome back' })
    ).toBeVisible();
  }

  async isLoggedIn() {
    await this.page.waitForSelector('text=All Products');
  }

  async isSettingsPageVisible() {
    await expect(
      this.page.getByRole('heading', { name: 'Project Settings' })
    ).toBeVisible();
  }

  async fillTeamName(projectName: string) {
    await this.page.locator('input[name="name"]').fill(projectName);
  }

  async isSaveButtonDisabled() {
    await expect(
      this.page.getByRole('button', { name: 'Save Changes' })
    ).toBeDisabled();
  }

  async isTeamNameLengthErrorVisible() {
    await expect(
      await this.page.getByText(
        'Project name should have at most 50 characters'
      )
    ).toBeVisible();
  }

  async isTeamSlugLengthErrorVisible() {
    await expect(
      await this.page.getByText('Slug should have at most 50 characters')
    ).toBeVisible();
  }

  async isDomainLengthErrorVisible() {
    await expect(
      await this.page.getByText('Domain should have at most 253 characters')
    ).toBeVisible();
  }

  async isDomainInvalidErrorVisible() {
    await expect(
      await this.page.getByText('Enter a domain name in the format example.com')
    ).toBeVisible();
  }

  async clickSaveButton() {
    await this.page.getByRole('button', { name: 'Save Changes' }).click();
  }

  async updateTeamName(newProjectName: string) {
    await this.fillTeamName(newProjectName);
    await this.clickSaveButton();
    await expect(
      this.page
        .getByRole('status')
        .filter({ hasText: this.updateTeamSuccessMessage })
        .last()
    ).toBeVisible();
  }

  async fillTeamSlug(projectSlug: string) {
    await this.page.locator('input[name="slug"]').fill(projectSlug);
  }

  async updateTeamSlug(newProjectSlug: string) {
    await this.fillTeamSlug(newProjectSlug);
    await this.clickSaveButton();
    await expect(
      this.page
        .getByRole('status')
        .filter({ hasText: this.updateTeamSuccessMessage })
        .last()
    ).toBeVisible();
  }

  async fillDomain(domain: string) {
    await this.page.locator('input[name="domain"]').fill(domain);
  }

  async updateDomain(domain: string) {
    await this.fillDomain(domain);
    await this.clickSaveButton();
    await expect(
      this.page
        .getByRole('status')
        .filter({ hasText: this.updateTeamSuccessMessage })
        .last()
    ).toBeVisible();
  }

  async checkTeamName(projectName: string) {
    await expect(this.page.locator('input[name="name"]')).toHaveValue(
      projectName
    );
  }

  async checkTeamSlug(projectSlug: string) {
    await expect(this.page.locator('input[name="slug"]')).toHaveValue(
      projectSlug
    );
  }

  async checkDomain(domain: string) {
    await expect(this.page.locator('input[name="domain"]')).toHaveValue(domain);
  }

  async createNewTeam(projectName: string) {
    await this.page.getByText('Example').first().click();
    await this.newProjectMenu.click();
    await expect(
      this.page.getByRole('heading', { name: 'Create Project' })
    ).toBeVisible();
    await this.newProjectNameInput.fill(projectName);
    await this.createTeamDialogButton.click();
    await expect(
      this.page
        .getByRole('status')
        .filter({ hasText: this.createTeamSuccessMessage })
        .last()
    ).toBeVisible();
  }

  async removeTeam(projectSlug: string) {
    this.goto(projectSlug);
    this.removeTeamButton.click();
    await expect(this.removeTeamConfirmPrompt).toBeVisible();
    this.deleteButton.click();
    await expect(
      this.page
        .getByRole('status')
        .filter({ hasText: this.removeTeamSuccessMessage })
        .last()
    ).toBeVisible();
  }

  async gotoSection(pageName: 'security' | 'api-keys') {
    await this.page.goto(`/settings/${pageName}`);
    await this.page.waitForURL(`/settings/${pageName}`);
  }

  async goto(projectSlug?: string, projectSlug = 'default') {
    await this.page.goto(
      `/orgs/${projectSlug}/projects/${projectSlug}/settings`
    );
    await this.page.waitForURL(
      `/orgs/${projectSlug}/projects/${projectSlug}/settings`
    );
  }
}
