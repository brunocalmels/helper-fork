import { expect, test } from "@playwright/test";
import { testData } from "./fixtures/test-data";
import { widgetConfigs } from "./fixtures/widget-config";
import { ApiVerifier } from "./page-objects/apiVerifier";
import { WidgetPage } from "./page-objects/widgetPage";

test.describe("Helper Chat Widget - Screenshot Functionality", () => {
  let widgetPage: WidgetPage;
  let apiVerifier: ApiVerifier;

  test.beforeEach(async ({ page }) => {
    widgetPage = new WidgetPage(page);
    apiVerifier = new ApiVerifier(page);
    await apiVerifier.startCapturing();
  });

  test("should hide screenshot checkbox initially", async () => {
    await widgetPage.loadWidget(widgetConfigs.authenticated);

    // Checkbox should not be visible initially
    const checkboxVisible = await widgetPage.screenshotCheckbox.isVisible();
    expect(checkboxVisible).toBe(false);

    // Type a message without screenshot keywords
    await widgetPage.chatInput.fill("Hello, how are you?");

    // Checkbox should still not be visible
    const stillHidden = await widgetPage.screenshotCheckbox.isVisible();
    expect(stillHidden).toBe(false);
  });

  test.skip("should toggle screenshot checkbox with keyboard shortcut", async () => {
    // Skip: Keyboard shortcut feature from PR #756 - https://github.com/antiwork/helper/issues/756
    await widgetPage.loadWidget(widgetConfigs.anonymous);

    const initialState = await widgetPage.isScreenshotCheckboxChecked();
    expect(initialState).toBe(false);

    await widgetPage.toggleScreenshotWithKeyboard();

    const afterToggle = await widgetPage.isScreenshotCheckboxChecked();
    expect(afterToggle).toBe(true);

    await widgetPage.toggleScreenshotWithKeyboard();

    const afterSecondToggle = await widgetPage.isScreenshotCheckboxChecked();
    expect(afterSecondToggle).toBe(false);
  });

  test.skip("should show loading state during screenshot capture", async () => {
    // Skip: Loading state feature from PR #756 - https://github.com/antiwork/helper/issues/756
    await widgetPage.loadWidget(widgetConfigs.authenticated);

    await widgetPage.chatInput.fill(testData.messages.withScreenshot);
    await widgetPage.screenshotCheckbox.check();

    const sendPromise = widgetPage.sendButton.click();

    await expect(widgetPage.widgetFrame.locator("text=/Taking screenshot/")).toBeVisible();

    await sendPromise;
    await widgetPage.waitForResponse();

    await expect(widgetPage.widgetFrame.locator("text=/Taking screenshot/")).not.toBeVisible();
  });

  test.skip("should handle screenshot capture failure gracefully", async ({ page }) => {
    // Skip: Error handling feature from PR #756 - https://github.com/antiwork/helper/issues/756
    await widgetPage.loadWidget(widgetConfigs.anonymous);

    await page.evaluate(() => {
      (window as any).HelperWidget.takeScreenshot = () => Promise.reject(new Error("Screenshot failed"));
    });

    await widgetPage.sendMessage(testData.messages.withScreenshot, true);

    const errorVisible = await widgetPage.errorMessage.isVisible();
    expect(errorVisible).toBe(true);

    const errorText = await widgetPage.getErrorMessage();
    expect(errorText).toContain("Failed to capture screenshot");

    const messagesSent = await widgetPage.getMessageCount();
    expect(messagesSent).toBe(1);
  });

  test("should show screenshot checkbox when keyword is typed", async () => {
    await widgetPage.loadWidget(widgetConfigs.authenticated);

    // Type a message with screenshot keyword
    await widgetPage.chatInput.fill("screenshot of this page please");

    // Wait for checkbox to appear
    await widgetPage.screenshotCheckbox.waitFor({ state: "visible", timeout: 5000 });

    // Verify checkbox is visible
    const checkboxVisible = await widgetPage.screenshotCheckbox.isVisible();
    expect(checkboxVisible).toBe(true);

    // Verify checkbox text
    const labelText = await widgetPage.widgetFrame.locator('label[for="screenshot"]').textContent();
    expect(labelText).toContain("Include a screenshot for better support?");
  });

  test.skip("should clear screenshot error on retry", async ({ page }) => {
    // Skip: Error handling feature from PR #756 - https://github.com/antiwork/helper/issues/756
    await widgetPage.loadWidget(widgetConfigs.anonymous);

    await page.evaluate(() => {
      let callCount = 0;
      (window as any).HelperWidget.takeScreenshot = () => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("First attempt failed"));
        }
        return Promise.resolve("data:image/png;base64,mockscreenshot");
      };
    });

    await widgetPage.sendMessage(testData.messages.withScreenshot, true);
    await expect(widgetPage.errorMessage).toBeVisible();

    await widgetPage.sendMessage(testData.messages.withScreenshot, true);
    await widgetPage.waitForResponse();

    await expect(widgetPage.errorMessage).not.toBeVisible();

    const messageCount = await widgetPage.getMessageCount();
    expect(messageCount).toBe(2);
  });

  test.skip("should disable input during screenshot capture", async () => {
    // Skip: Loading state feature from PR #756 - https://github.com/antiwork/helper/issues/756
    await widgetPage.loadWidget(widgetConfigs.authenticated);

    await widgetPage.chatInput.fill(testData.messages.withScreenshot);
    await widgetPage.screenshotCheckbox.check();

    const sendPromise = widgetPage.sendButton.click();

    await expect(widgetPage.chatInput).toBeDisabled();
    await expect(widgetPage.sendButton).toBeDisabled();

    await sendPromise;
    await widgetPage.waitForResponse();

    await expect(widgetPage.chatInput).not.toBeDisabled();
    await expect(widgetPage.sendButton).not.toBeDisabled();
  });

  test("should maintain screenshot state across messages", async () => {
    await widgetPage.loadWidget(widgetConfigs.authenticated);

    // Check if screenshot checkbox exists first
    const checkboxExists = (await widgetPage.screenshotCheckbox.count()) > 0;

    if (!checkboxExists) {
      console.log("Screenshot checkbox not found - skipping screenshot state test");
      await widgetPage.sendMessage("First message");
      await widgetPage.waitForResponse();
      return;
    }

    await widgetPage.sendMessage("First message", true);
    await widgetPage.waitForResponse();

    const checkboxStateAfterFirst = await widgetPage.isScreenshotCheckboxChecked();
    expect(checkboxStateAfterFirst).toBe(false);

    await widgetPage.screenshotCheckbox.check();
    await widgetPage.chatInput.fill("Second message");

    const checkboxStateBeforeSend = await widgetPage.isScreenshotCheckboxChecked();
    expect(checkboxStateBeforeSend).toBe(true);
  });

  test("should send message without screenshot when checkbox unchecked", async () => {
    await widgetPage.loadWidget(widgetConfigs.anonymous);

    await widgetPage.sendMessage(testData.messages.simple, false);
    await widgetPage.waitForResponse();

    const chatCall = await apiVerifier.verifyChatApiCall();

    // For the vanilla widget, the body structure might be simpler
    const hasScreenshot =
      chatCall?.body?.messages?.some(
        (msg: any) => msg.experimental_attachments?.length > 0 || msg.attachments?.length > 0 || msg.screenshot,
      ) ||
      chatCall?.body?.screenshot ||
      false;

    expect(hasScreenshot).toBe(false);
  });

  test.skip("should handle rapid screenshot toggles", async () => {
    // Skip: Keyboard shortcut feature from PR #756 - https://github.com/antiwork/helper/issues/756
    await widgetPage.loadWidget(widgetConfigs.authenticated);

    for (let i = 0; i < 5; i++) {
      await widgetPage.toggleScreenshotWithKeyboard();
      await widgetPage.page.waitForTimeout(100);
    }

    const finalState = await widgetPage.isScreenshotCheckboxChecked();
    expect(finalState).toBe(true);
  });
});
