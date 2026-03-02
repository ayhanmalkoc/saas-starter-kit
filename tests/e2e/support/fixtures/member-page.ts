import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class MemberPage {
  private readonly page: Page;
  private readonly projectSlug: string;
  private readonly membersHeading: Locator;
  private readonly inviteMemberButton: Locator;
  private readonly inviteEmailField: Locator;
  private readonly inviteButton: Locator;
  private readonly inviteDomainField: Locator;
  private readonly createInviteLinkButton: Locator;
  private readonly inviteByLinkSuccessText: Locator;
  private readonly removeMemberButton: Locator;
  private readonly deleteButtonForMember: Locator;

  constructor(page: Page, projectSlug: string) {
    this.page = page;
    this.projectSlug = projectSlug;
    this.membersHeading = this.page.getByRole('heading', {
      name: 'Members',
    });
    this.inviteMemberButton = this.page.getByRole('button', {
      name: 'Invite Member',
    });
    this.inviteEmailField = this.page.getByPlaceholder('jackson@boxyhq.com');
    this.inviteButton = this.page.getByRole('button', {
      name: 'Invite',
      exact: true,
    });
    this.inviteDomainField = this.page.getByPlaceholder(
      'Restrict domain: boxyhq.com'
    );
    this.createInviteLinkButton = this.page.getByRole('button', {
      name: 'Create Link',
    });
    this.inviteByLinkSuccessText = this.page.getByText(
      'Share your project invite link'
    );
    this.removeMemberButton = this.page
      .getByRole('cell', { name: 'Remove' })
      .first();
    this.deleteButtonForMember = this.page.getByRole('button', {
      name: 'Delete',
    });
  }

  async goto() {
    await this.page.goto(`/orgs/${this.projectSlug}/projects/default/members`);
    await this.page.waitForURL(
      `/orgs/${this.projectSlug}/projects/default/members`
    );
    await this.membersPageVisible();
  }

  async membersPageVisible() {
    await expect(this.membersHeading).toBeVisible();
  }

  async teamMemberExists(
    name: string,
    email: string,
    role: 'OWNER' | 'MEMBER'
  ) {
    await expect(this.memberEntryRowName(name)).toBeVisible();
    await expect(this.memberEntryRowEmail(email)).toBeVisible();
    await expect(this.memberEntryRowRole(role)).toBeVisible();
  }

  private memberEntryRowRole(role: string) {
    return this.page.getByRole('cell', { name: role, exact: true });
  }

  private memberEntryRowEmail(email: string) {
    return this.page.getByRole('cell', { name: email });
  }

  private memberEntryRowName(name: string) {
    return this.page
      .getByRole('cell', { name: `${name.charAt(0).toUpperCase()} ${name}` })
      .locator('span');
  }

  async openInviteModal() {
    await this.inviteMemberButton.click();
    await expect(
      this.page.getByRole('heading', {
        name: 'Invite New Member',
      })
    ).toBeVisible();
  }

  async fillEmailForInvite(email: string) {
    await this.inviteEmailField.fill(email);
  }

  async isInviteButtonDisabled() {
    await expect(this.inviteButton).toBeDisabled();
  }

  async inviteByEmail(email: string) {
    await this.openInviteModal();
    await this.fillEmailForInvite(email);

    const invitationRequest = this.page.waitForResponse(
      (response) =>
        response.url().includes('/invitations') &&
        response.request().method() === 'POST'
    );

    await this.inviteButton.click();
    const invitationResponse = await invitationRequest;
    expect(invitationResponse.ok()).toBeTruthy();
  }

  async checkPendingInvitation(email: string, role: string) {
    await this.pendingMemberVisible();

    await expect(this.memberEntryRowEmail(email)).toBeVisible();
    await expect(this.memberEntryRowRole(role)).toBeVisible();
  }

  async pendingMemberVisible() {
    await expect(this.page.getByText('Pending Invitations')).toBeVisible();
  }

  async createInviteLink(domain: string) {
    await this.openInviteModal();

    await this.inviteDomainField.fill(domain);
    await this.createInviteLinkButton.click();

    await expect(this.inviteByLinkSuccessText).toBeVisible();
    const domainInviteLink = await this.page
      .getByRole('textbox')
      .nth(1)
      .inputValue();
    return domainInviteLink;
  }

  async removeMember() {
    await this.removeMemberButton.click();
    await expect(
      this.page.getByRole('heading', { name: 'Confirm deletion of member' })
    ).toBeVisible();
    await this.deleteButtonForMember.click();
    await expect(
      this.page.getByText('Member deleted successfully.')
    ).toBeVisible();
  }
}
