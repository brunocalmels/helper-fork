import { expect } from "@playwright/test";
import { debugWait } from "../test-helpers";
import { BasePage } from "./basePage";

/**
 * ConversationsPage - Page object for Helper conversations interactions
 */
export class ConversationsPage extends BasePage {
  // Real selectors that actually exist in the application
  private readonly searchInput = 'input[placeholder="Search conversations"]';
  private readonly openFilter = 'button:has-text("open")';
  private readonly gumroadButton = 'button:has-text("Gumroad")';
  private readonly supportEmailButton = 'button:has-text("support@gumroad.com")';
  private readonly selectAllButton = 'button:has-text("Select all")';
  private readonly deselectButton = 'button:has-text("Deselect")';

  private readonly conversationLinks = 'a[href*="/conversations?id="]';

  async navigateToConversations() {
    await this.goto("/mine");
    await this.waitForPageLoad();
  }

  async waitForConversationsLoad() {
    await this.page.waitForLoadState("networkidle");
    await expect(this.page.locator(this.searchInput)).toBeVisible();
  }

  async expectConversationsVisible() {
    await expect(this.page).toHaveTitle("Helper");
    await expect(this.page.locator(this.searchInput)).toBeVisible();
    await expect(this.page.locator(this.openFilter)).toBeVisible();
  }

  async searchConversations(query: string) {
    const searchBox = this.page.locator(this.searchInput);
    await expect(searchBox).toBeVisible();
    await searchBox.fill(query);
    // Enter key is optional - many search boxes auto-search
    await this.page.keyboard.press("Enter");
  }

  async clearSearch() {
    const searchBox = this.page.locator(this.searchInput);
    await searchBox.clear();
    await expect(searchBox).toHaveValue("");
  }

  async expectSearchValue(value: string) {
    await expect(this.page.locator(this.searchInput)).toHaveValue(value);
  }

  async clickOpenFilter() {
    await this.page.locator(this.openFilter).click();
    await debugWait(this.page, 1000); // Allow for filter response
  }

  async expectAccountInfo() {
    // Use .first() to handle multiple matches as discovered in working tests
    await expect(this.page.locator(this.gumroadButton).first()).toBeVisible();
    await expect(this.page.locator(this.supportEmailButton).first()).toBeVisible();
  }

  async clickGumroadButton() {
    await this.page.locator(this.gumroadButton).first().click();
    await debugWait(this.page, 2000);
  }

  async handleSelectAll() {
    // Check if there are any conversations first
    const conversationLinks = this.page.locator(this.conversationLinks);
    const conversationCount = await conversationLinks.count();

    if (conversationCount === 0) {
      return false; // No conversations, select all should not be available
    }

    const selectAllCount = await this.page.locator(this.selectAllButton).count();

    if (selectAllCount > 0) {
      await this.page.locator(this.selectAllButton).click();
      await debugWait(this.page, 1000);
      return true;
    }
    return false;
  }

  async expectSelectAllButtonExists(): Promise<boolean> {
    // Check if conversations exist first
    const conversationLinks = this.page.locator(this.conversationLinks);
    const conversationCount = await conversationLinks.count();

    if (conversationCount === 0) {
      return false; // No conversations, select all should not exist
    }

    const count = await this.page.locator(this.selectAllButton).count();
    return count > 0;
  }

  async expectDeselectButtonExists(): Promise<boolean> {
    const count = await this.page.locator(this.deselectButton).count();
    return count > 0;
  }

  async setMobileViewport() {
    await this.page.setViewportSize({ width: 375, height: 667 });
  }

  async setDesktopViewport() {
    await this.page.setViewportSize({ width: 1280, height: 720 });
  }

  async refreshAndWaitForAuth() {
    await this.page.reload();
    await this.page.waitForLoadState("networkidle");
    await expect(this.page).toHaveURL(/.*mine.*/);
    await this.waitForConversationsLoad();
  }

  async focusSearchInput() {
    const searchBox = this.page.locator(this.searchInput);
    await searchBox.focus();

    // Verify focus landed correctly
    const focusedPlaceholder = await this.page.evaluate(() => document.activeElement?.getAttribute("placeholder"));

    return focusedPlaceholder === "Search conversations";
  }

  getCurrentUrl(): string {
    return this.page.url();
  }

  expectUrlContains(fragment: string) {
    expect(this.page.url()).toContain(fragment);
  }

  // Generic conversation list methods (these would need real selectors when we find them)
  getConversationCount(): number {
    // This would need real conversation item selectors
    return 0;
  }

  selectConversation(index = 0) {
    // This would need real conversation item selectors
  }
}
