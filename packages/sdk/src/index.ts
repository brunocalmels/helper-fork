// This is *only* used for the SDK output in the public directory and is not importable by the Next.js app

import { Context } from "modern-screenshot";
import React from "react";
import embedStyles from "./embed.css";
import GuideManager from "./guideManager";
import { scriptOrigin } from "./scriptOrigin";
import {
  CLOSE_ACTION,
  CONVERSATION_UPDATE_ACTION,
  GUIDE_DONE,
  GUIDE_START,
  MINIMIZE_ACTION,
  READY_ACTION,
  SCREENSHOT_ACTION,
  SHOW_WIDGET,
  type HelperWidgetConfig,
  type NotificationStatus,
} from "./utils";

declare global {
  interface Window {
    helperWidgetConfig?: HelperWidgetConfig;
  }
}

const GUMROAD_MAILBOX_SLUG = "gumroad";

const screenshotWorkerUrl = new URL("modern-screenshot/dist/worker.js", import.meta.url).href;

interface Notification {
  id: number;
  text: string;
  conversationSlug: string;
  status: NotificationStatus;
}

class HelperWidget {
  private static instance: HelperWidget | null = null;
  private config: HelperWidgetConfig;
  private iframe: HTMLIFrameElement | null = null;
  private iframeWrapper: HTMLDivElement | null = null;
  private helperIcon: HTMLButtonElement | null = null;
  private loadingOverlay: HTMLDivElement | null = null;
  private notificationContainer: HTMLDivElement | null = null;
  private notificationBubbles: Map<string, HTMLDivElement> = new Map<string, HTMLDivElement>();
  private isVisible = false;
  private isIframeReady = false;
  private toggleButton: HTMLButtonElement | null = null;
  private hasBeenOpened = false;
  private sessionToken: string | null = null;
  private showWidget = false;
  private showToggleButton: boolean | null = null;
  private isMinimized = true;
  private guideManager: GuideManager;

  private messageQueue: any[] = [];
  private observer: MutationObserver | null = null;
  private readonly messageType: string = "HELPER_WIDGET_MESSAGE";
  private readonly VISIBILITY_STORAGE_KEY = "helper_widget_visible";
  private readonly CONVERSATION_STORAGE_KEY = "helper_widget_conversation";
  private readonly MINIMIZED_STORAGE_KEY = "helper_widget_minimized";
  private readonly ANONYMOUS_SESSION_TOKEN_KEY = "helper_widget_anonymous_session_token";
  private readonly HAS_BEEN_OPENED_STORAGE_KEY = "helper_widget_has_been_opened";
  private currentConversationSlug: string | null = null;
  private screenshotContext: Context | null = null;
  private renderedContactForms: Set<HTMLElement> = new Set();

  private constructor(config: HelperWidgetConfig) {
    this.config = config;
    this.showToggleButton = config.showToggleButton ?? null;
    this.isMinimized = localStorage.getItem(this.MINIMIZED_STORAGE_KEY) === "true";
    this.guideManager = new GuideManager(this);
  }

  private async setup(): Promise<void> {
    this.injectStyles();
    this.createLoadingOverlay();
    this.createWrapper();
    this.createNotificationContainer();
    this.setupEventListeners();
    await this.createSessionWithRetry();
    this.createToggleButton();
    this.loadPreviousStatusFromLocalStorage();
    await this.guideManager.checkForResumableGuideSession();
  }

  private async createSessionWithRetry() {
    for (let i = 0; i < 3; i++) {
      if (await this.createSession()) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    // eslint-disable-next-line no-console
    console.error("Failed to create Helper session after 3 attempts");
  }

  private async createSession() {
    if (!this.validateConfig()) {
      // eslint-disable-next-line no-console
      console.error("Invalid config, missing required fields", this.config);
      return;
    }

    try {
      const requestBody: Record<string, any> = {
        currentURL: window.location.href,
      };

      if (!this.isAnonymous()) {
        if (!this.config.emailHash || !this.config.timestamp) {
          // eslint-disable-next-line no-console
          console.error("Email authentication fields missing");
          return;
        }

        requestBody.email = this.config.email;
        requestBody.emailHash = this.config.emailHash;
        requestBody.timestamp = this.config.timestamp;
        requestBody.customerMetadata = this.config.customerMetadata;
      } else {
        requestBody.currentToken = localStorage.getItem(this.ANONYMOUS_SESSION_TOKEN_KEY);
      }

      const response = await fetch(`${scriptOrigin}/api/widget/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.error("Session creation failed");
        return;
      }

      const data = await response.json();
      if (data.token) {
        this.sessionToken = data.token;
        this.setShowWidget(data.showWidget);
        if (data.notifications?.length > 0) {
          setTimeout(() => {
            // Show notifications from bottom to top with staggered timing
            [...data.notifications].reverse().forEach((notification: Notification, index: number) => {
              setTimeout(() => {
                this.showNotification(notification.text, notification.conversationSlug, notification.id);
              }, index * 800);
            });
          }, 2000);
        }
        if (this.isAnonymous()) {
          localStorage.setItem(this.ANONYMOUS_SESSION_TOKEN_KEY, data.token);
        } else {
          localStorage.removeItem(this.ANONYMOUS_SESSION_TOKEN_KEY);
        }
      }
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create Helper session:", error);
      return false;
    }
  }

  private loadPreviousStatusFromLocalStorage(): void {
    if (!this.sessionToken) return;

    // Load hasBeenOpened state
    this.hasBeenOpened = localStorage.getItem(this.HAS_BEEN_OPENED_STORAGE_KEY) === "true";

    const wasVisible = localStorage.getItem(this.VISIBILITY_STORAGE_KEY) === "true";
    if (wasVisible) {
      this.showInternal();
    }

    const savedConversation = localStorage.getItem(this.CONVERSATION_STORAGE_KEY);
    if (savedConversation && savedConversation.length > 0 && wasVisible) {
      this.currentConversationSlug = savedConversation;
    }

    // Only load minimized state on desktop
    if (window.innerWidth >= 640) {
      this.isMinimized = localStorage.getItem(this.MINIMIZED_STORAGE_KEY) === "true";
      if (this.isMinimized && this.iframeWrapper) {
        this.iframeWrapper.classList.add("minimized");
      }
    }
  }

  private setShowWidget(showWidget: boolean): void {
    this.showWidget = showWidget || this.showToggleButton === true;
    if (this.showWidget) {
      this.addHelperIcon();
      if (this.notificationContainer) {
        this.notificationContainer.classList.add("with-widget");
      }
    } else if (this.notificationContainer) {
      this.notificationContainer.classList.remove("with-widget");
    }
  }

  private validateConfig(): boolean {
    return true;
  }

  private createWrapper(): void {
    if (this.iframeWrapper) return;

    this.iframeWrapper = document.createElement("div");
    this.iframeWrapper.className = "helper-widget-wrapper";

    if (this.loadingOverlay) {
      this.iframeWrapper.appendChild(this.loadingOverlay);
    }

    document.body.appendChild(this.iframeWrapper);
  }

  private injectStyles(): void {
    const style = document.createElement("style");
    style.textContent = embedStyles;
    document.head.appendChild(style);
  }

  private createLoadingOverlay(): void {
    this.loadingOverlay = document.createElement("div");
    this.loadingOverlay.className = "helper-widget-loading-overlay";
    this.loadingOverlay.innerHTML = '<div class="helper-widget-spinner"></div>';
  }

  private isLightColor(color: string): boolean {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }

  public getIconColors(): { backgroundColor: string; foregroundColor: string } {
    const backgroundColor = this.config.iconColor || "#222";
    const foregroundColor = this.isLightColor(backgroundColor) ? "#000000" : "#FFFFFF";
    return { backgroundColor, foregroundColor };
  }

  private addHelperIcon(): void {
    if (this.helperIcon) return;

    this.helperIcon = document.createElement("button");
    this.helperIcon.className = "helper-widget-icon";

    const { backgroundColor, foregroundColor } = this.getIconColors();

    this.helperIcon.innerHTML = `<svg class="hand-icon" width="26" height="29" viewBox="0 0 26 29" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.9885 19.1603C14.4462 16.4526 25.36 8.80865 25.36 8.80865L22.5717 4.78239C22.5717 4.78239 18.2979 8.46521 15.1353 12.7541C14.4648 13.7215 13.1488 12.9234 13.9447 11.5515C15.9064 8.16995 21.5892 2.70127 21.5892 2.70127L17.2712 0.54569C17.2712 0.54569 14.458 3.38303 10.9133 10.5004C10.2651 11.8018 8.94659 11.1429 9.39493 9.80167C10.5422 6.36947 14.2637 0.913031 14.2637 0.913031L9.74091 0.17627C9.74091 0.17627 7.30141 4.59585 5.78539 10.0891C5.46118 11.2634 4.04931 10.9838 4.2171 9.81717C4.50759 7.79708 6.51921 1.95354 6.51921 1.95354L2.60762 1.97033C2.60762 1.97033 -0.737277 9.78607 1.7329 18.4073C3.13956 23.3167 7.54191 28.1763 13.287 28.1763C18.9209 28.1763 23.8513 23.8362 25.5294 17.1416L21.6221 14.1778C21.6221 14.1778 19.4441 21.7758 16.9885 19.1603Z" fill="${foregroundColor}"/></svg>`;
    this.helperIcon.style.backgroundColor = backgroundColor;

    document.body.appendChild(this.helperIcon);
    this.connectToggleElement(this.helperIcon);
  }

  private createIframe(): void {
    if (this.iframe) return;

    this.iframe = document.createElement("iframe");
    this.iframe.className = "helper-widget-iframe";
    this.iframe.allow = "microphone *";
    this.iframe.src = `${scriptOrigin}/widget/embed`;

    if (this.iframeWrapper) {
      this.iframeWrapper.appendChild(this.iframe);
    }

    this.showLoadingOverlay();
  }

  private showLoadingOverlay(): void {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.add("visible");
    }
  }

  private hideLoadingOverlay(): void {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.remove("visible");
    }
  }

  private setupEventListeners(): void {
    this.connectExistingPromptElements();
    this.connectExistingToggleElements();
    this.connectExistingContactFormElements();
    this.setupMutationObserver();
    this.setupNavigationDetection();

    let resizeTimeout: NodeJS.Timeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const isSmallScreen = window.innerWidth < 640;
        if (isSmallScreen) {
          // Force maximize and clear minimized state on mobile
          this.maximizeInternal();
          localStorage.removeItem(this.MINIMIZED_STORAGE_KEY);
        }
        this.sendMessageToEmbed({
          action: "CONFIG",
          content: {
            config: { ...this.config, viewportWidth: window.innerWidth },
            sessionToken: this.sessionToken,
            pageHTML: document.documentElement.outerHTML,
            currentURL: window.location.href,
          },
        });
      }, 100);
    });

    window.addEventListener("message", async (event: MessageEvent) => {
      // Handle messages from our iframe
      if (event.data && event.data.type === this.messageType) {
        const { action, requestId, content } = event.data.payload || {};

        // Handle request-response pattern messages (has requestId)
        if (requestId) {
          try {
            let response: any = null;

            if (action === "FETCH_PAGE_DETAILS") {
              response = this.guideManager.fetchCurrentPageDetails();
            }

            if (action === "CLICK_ELEMENT") {
              response = await this.guideManager.clickElement(content.index);
            }

            if (action === "SELECT_DROPDOWN_OPTION") {
              response = await this.guideManager.selectDropdownOption(content.index, content.text);
            }

            if (action === "EXECUTE_GUIDE_ACTION") {
              const { actionType, params, currentState } = content;
              response = await this.guideManager.executeDOMAction(actionType, params, currentState);
            }

            if (action === GUIDE_DONE) {
              const { success, message } = content;
              this.guideManager.done(success, message);
            }

            if (action === "CANCEL_GUIDE") {
              this.guideManager.cancel();
            }

            // Send the response back to the iframe
            if (event.source && "postMessage" in event.source) {
              (event.source as Window).postMessage(
                {
                  type: this.messageType,
                  payload: {
                    responseId: requestId,
                    response,
                  },
                },
                scriptOrigin,
              );
            }
          } catch (error) {
            // Send error back to iframe
            if (event.source && "postMessage" in event.source) {
              (event.source as Window).postMessage(
                {
                  type: this.messageType,
                  payload: {
                    responseId: requestId,
                    error: error instanceof Error ? error.message : String(error),
                  },
                },
                scriptOrigin,
              );
            }
          }
          return;
        }

        if (event.origin === scriptOrigin) {
          const { action, content } = event.data.payload;
          switch (action) {
            case CLOSE_ACTION:
              HelperWidget.hide();
              break;
            case MINIMIZE_ACTION:
              HelperWidget.minimize();
              break;
            case READY_ACTION:
              this.onIframeReady();
              break;
            case SHOW_WIDGET:
              this.showInternal();
              break;
            case CONVERSATION_UPDATE_ACTION:
              if (content.conversationSlug && content.conversationSlug.length > 0) {
                this.currentConversationSlug = content.conversationSlug;
                if (!this.isAnonymous()) {
                  localStorage.setItem(this.CONVERSATION_STORAGE_KEY, content.conversationSlug || "");
                }
              }
              break;
            case GUIDE_START:
              if (this.sessionToken && content.sessionId) {
                this.guideManager.start(this.sessionToken, content.sessionId);
              }
              break;
            case SCREENSHOT_ACTION:
              this.takeScreenshot();
              break;
            case "TOGGLE_WIDGET_HEIGHT":
              if (this.isMinimized) {
                this.maximizeInternal();
              } else {
                this.minimizeInternal();
              }
              break;
            case "CLEAR_ANONYMOUS_SESSION":
              localStorage.removeItem(this.ANONYMOUS_SESSION_TOKEN_KEY);
              await this.createSessionWithRetry();
              this.initFrameConfig();
              break;
          }
        }
      }
    });
  }

  private onIframeReady(): void {
    if (this.isIframeReady) return;

    this.isIframeReady = true;
    this.hideLoadingOverlay();
    this.initFrameConfig();
    this.processMessageQueue();

    // If there's a saved conversation, open it
    if (this.currentConversationSlug) {
      this.sendMessageToEmbed({
        action: "OPEN_CONVERSATION",
        content: { conversationSlug: this.currentConversationSlug },
      });
    }
  }

  private initFrameConfig(): void {
    this.sendMessageToEmbed({
      action: "CONFIG",
      content: {
        config: { ...this.config, viewportWidth: window.innerWidth },
        sessionToken: this.sessionToken,
        pageHTML: document.documentElement.outerHTML,
        currentURL: window.location.href,
        isMinimized: this.isMinimized,
      },
    });
  }

  private connectExistingPromptElements(): void {
    document.querySelectorAll("[data-helper-prompt]").forEach(this.connectPromptElement.bind(this));
  }

  private connectExistingContactFormElements(): void {
    document.querySelectorAll("[data-helper-contact-form]").forEach(this.connectContactFormElement.bind(this));
  }

  private connectPromptElement(element: Element): void {
    element.addEventListener("click", (event: Event) => this.handlePromptClick(event as MouseEvent));
  }

  private handlePromptClick(event: MouseEvent): void {
    const promptElement = event.currentTarget as HTMLElement;
    const prompt = promptElement.getAttribute("data-helper-prompt");

    if (prompt) {
      this.sendPromptToEmbed(prompt);
      promptElement.setAttribute("data-helper-prompt-sent", "true");
    }

    HelperWidget.show();
  }

  private connectExistingToggleElements(): void {
    document.querySelectorAll("[data-helper-toggle]").forEach(this.connectToggleElement.bind(this));
  }

  private connectToggleElement(element: Element): void {
    element.addEventListener("click", (event: Event) => this.handleToggleClick(event as MouseEvent));
  }

  private connectContactFormElement(element: Element): void {
    this.renderContactForm(element as HTMLElement);
  }

  private handleToggleClick(event: MouseEvent): void {
    const toggleElement = event.currentTarget as HTMLElement;
    HelperWidget.toggle();
    this.updateToggleState(toggleElement);
  }

  private updateToggleState(element: HTMLElement): void {
    const isOpen = this.isVisible ? "true" : "false";
    element.setAttribute("data-helper-open", isOpen);
  }

  private setupMutationObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              if (node.hasAttribute("data-helper-prompt")) {
                this.connectPromptElement(node);
              }
              if (node.hasAttribute("data-helper-toggle")) {
                this.connectToggleElement(node);
              }
              if (node.hasAttribute("data-helper-contact-form")) {
                this.connectContactFormElement(node);
              }
              node.querySelectorAll("[data-helper-prompt]").forEach(this.connectPromptElement.bind(this));
              node.querySelectorAll("[data-helper-toggle]").forEach(this.connectToggleElement.bind(this));
              node.querySelectorAll("[data-helper-contact-form]").forEach(this.connectContactFormElement.bind(this));
            }
          });
        }
      }
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  private setupNavigationDetection(): void {
    // Listen for page navigation events that work across different frameworks
    window.addEventListener("pageshow", () => {
      setTimeout(() => this.ensureDOMIntegrity(), 100);
    });

    // Listen for popstate (back/forward navigation)
    window.addEventListener("popstate", () => {
      setTimeout(() => this.ensureDOMIntegrity(), 100);
    });

    // Track URL changes as fallback for SPA navigation
    let currentUrl = window.location.href;
    const checkUrlChange = () => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        currentUrl = newUrl;
        this.ensureDOMIntegrity();
      }
    };

    // Check for URL changes periodically (fallback for frameworks that don't trigger events)
    setInterval(checkUrlChange, 1000);
  }

  private ensureDOMIntegrity(): void {
    let needsRecreation = false;

    // Check if essential elements are missing from DOM using isConnected
    if (this.iframeWrapper && !this.iframeWrapper.isConnected) {
      this.iframeWrapper = null;
      this.iframe = null;
      this.isIframeReady = false;
      needsRecreation = true;
    }

    if (this.helperIcon && !this.helperIcon.isConnected) {
      this.helperIcon = null;
      needsRecreation = true;
    }

    if (this.notificationContainer && !this.notificationContainer.isConnected) {
      this.notificationContainer = null;
      this.notificationBubbles.clear();
      needsRecreation = true;
    }

    if (this.toggleButton && !this.toggleButton.isConnected) {
      this.toggleButton = null;
      needsRecreation = true;
    }

    if (needsRecreation) {
      this.recreateMissingElements();
    }
  }

  private recreateMissingElements(): void {
    // Load hasBeenOpened state from localStorage in case it was lost
    this.hasBeenOpened = localStorage.getItem(this.HAS_BEEN_OPENED_STORAGE_KEY) === "true";
    
    // Recreate wrapper if missing
    if (!this.iframeWrapper) {
      this.createLoadingOverlay();
      this.createWrapper();
    }

    // Recreate notification container if missing
    if (!this.notificationContainer) {
      this.createNotificationContainer();
    }
    
    // Recreate helper icon if missing and should be shown
    if (!this.helperIcon && this.showWidget) {
      this.addHelperIcon();
    }

    // Recreate toggle button if missing and was previously shown
    if (!this.toggleButton && this.hasBeenOpened) {
      this.createToggleButton();
      if (this.toggleButton) {
        document.body.appendChild(this.toggleButton);
        const wasVisible = localStorage.getItem(this.VISIBILITY_STORAGE_KEY) === "true";
        if (!wasVisible && (this.showToggleButton === true || (this.showToggleButton === null && !this.showWidget))) {
          (this.toggleButton as HTMLButtonElement).classList.add("visible");
        }
      }
    }

    // Restore visibility state if widget was visible
    const wasVisible = localStorage.getItem(this.VISIBILITY_STORAGE_KEY) === "true";
    if (wasVisible && this.iframeWrapper) {
      this.iframeWrapper.classList.add("visible");
      this.isVisible = true;
      
      // Recreate iframe if it was visible but missing
      if (!this.iframe) {
        this.isIframeReady = false;
        this.createIframe();
      }
    }

    // Restore minimized state (only on desktop)
    if (window.innerWidth >= 640) {
      const wasMinimized = localStorage.getItem(this.MINIMIZED_STORAGE_KEY) === "true";
      if (wasMinimized && this.iframeWrapper) {
        this.iframeWrapper.classList.add("minimized");
        this.isMinimized = true;
        if (this.toggleButton) {
          this.toggleButton.classList.add("with-minimized-widget");
        }
      } else {
        this.isMinimized = false;
      }
    }

    // Restore conversation state
    const savedConversation = localStorage.getItem(this.CONVERSATION_STORAGE_KEY);
    if (savedConversation && savedConversation.length > 0) {
      this.currentConversationSlug = savedConversation;
    }
  }

  private createToggleButton(): void {
    // Skip creating the toggle button if explicitly disabled
    if (this.showToggleButton === false) return;
    if (this.toggleButton) return;

    this.toggleButton = document.createElement("button");
    this.toggleButton.className = "helper-widget-toggle-button";

    const { backgroundColor, foregroundColor } = this.getIconColors();

    this.toggleButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="${foregroundColor}" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
</svg>
    `;
    this.toggleButton.style.backgroundColor = backgroundColor;
    this.toggleButton.addEventListener("click", () => HelperWidget.show());
  }

  private sendMessageToEmbed(message: any): void {
    if (this.isIframeReady && this.iframe?.contentWindow) {
      this.iframe.contentWindow.postMessage({ type: this.messageType, payload: message }, scriptOrigin);
    } else {
      this.messageQueue.push(message);
      if (!this.iframe) {
        this.createIframe();
      }
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.sendMessageToEmbed(message);
    }
  }

  private sendPromptToEmbed(prompt: string | null): void {
    this.sendMessageToEmbed({ action: "PROMPT", content: prompt });
  }

  private startGuideInternal(prompt: string): void {
    this.sendMessageToEmbed({ action: "START_GUIDE", content: prompt });
    setTimeout(() => {
      this.showInternal();
    }, 1000);
  }

  private showInternal(): void {
    if (!this.iframe) {
      this.createIframe();
    }
    if (this.iframeWrapper && !this.isVisible) {
      this.iframeWrapper.classList.add("visible");
      if (!this.isIframeReady) {
        this.showLoadingOverlay();
      }
      this.isVisible = true;
      localStorage.setItem(this.VISIBILITY_STORAGE_KEY, "true");
      this.updateAllToggleElements();

      if (!this.hasBeenOpened) {
        this.hasBeenOpened = true;
        localStorage.setItem(this.HAS_BEEN_OPENED_STORAGE_KEY, "true");
        // Create and append the toggle button when the widget is first opened
        this.createToggleButton();
        if (this.toggleButton) {
          document.body.appendChild(this.toggleButton);
        }
      }

      // Hide the toggle button when the widget is visible
      if (this.toggleButton) {
        this.toggleButton.classList.remove("visible");
        if (this.isMinimized) {
          this.toggleButton.classList.add("with-minimized-widget");
        }
      }
    }
    this.showWidgetAfterAnimation();
    if (this.helperIcon) {
      this.helperIcon.classList.add("scaled-down");
    }
  }

  private hideInternal(): void {
    if (this.iframeWrapper && this.isVisible) {
      this.guideManager.clearSession();
      this.iframeWrapper.classList.remove("visible");
      this.hideLoadingOverlay();
      this.isVisible = false;
      localStorage.setItem(this.VISIBILITY_STORAGE_KEY, "false");
      this.updateAllToggleElements();

      // Show the toggle button when the widget is hidden (only if it has been opened before)
      if (
        this.hasBeenOpened &&
        this.toggleButton &&
        (this.showToggleButton === true || (this.showToggleButton === null && !this.showWidget))
      ) {
        this.toggleButton.classList.add("visible");
        this.toggleButton.classList.remove("with-minimized-widget");
      }
    }
    if (this.helperIcon) {
      this.helperIcon.classList.remove("scaled-down");
    }
  }

  private toggleInternal(): void {
    if (this.isVisible) {
      this.hideInternal();
    } else {
      this.showInternal();
    }
    this.updateAllToggleElements();
  }

  private minimizeInternal(): void {
    if (this.iframeWrapper && window.innerWidth >= 640) {
      this.iframeWrapper.classList.add("minimized");
      this.isMinimized = true;
      localStorage.setItem(this.MINIMIZED_STORAGE_KEY, "true");
      if (this.toggleButton) {
        this.toggleButton.classList.add("with-minimized-widget");
      }
    }
  }

  private maximizeInternal(): void {
    if (this.iframeWrapper) {
      this.iframeWrapper.classList.remove("minimized");
      this.isMinimized = false;
      if (window.innerWidth >= 640) {
        localStorage.setItem(this.MINIMIZED_STORAGE_KEY, "false");
      } else {
        localStorage.removeItem(this.MINIMIZED_STORAGE_KEY);
      }
      if (this.toggleButton) {
        this.toggleButton.classList.remove("with-minimized-widget");
      }
    }
  }

  private toggleMinimize(): void {
    if (this.isMinimized) {
      this.maximizeInternal();
    } else {
      this.minimizeInternal();
    }
  }

  private updateAllToggleElements(): void {
    document.querySelectorAll("[data-helper-toggle]").forEach((element) => {
      this.updateToggleState(element as HTMLElement);
    });
  }

  private async renderContactForm(element: HTMLElement): Promise<void> {
    if (this.renderedContactForms.has(element)) {
      return;
    }

    this.renderedContactForms.add(element);

    const [{ createRoot }, { ContactForm }] = await Promise.all([
      import("react-dom/client"),
      import("./components/contactForm"),
    ]);

    const root = createRoot(element);

    const handleSubmit = async (email: string, message: string) => {
      const response = await fetch(`${scriptOrigin}/api/chat/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.sessionToken}`,
        },
        body: JSON.stringify({
          email,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }
    };

    root.render(React.createElement(ContactForm, { onSubmit: handleSubmit }));
  }

  private destroyInternal(): void {
    if (this.iframeWrapper) {
      document.body.removeChild(this.iframeWrapper);
    }
    if (this.toggleButton) {
      document.body.removeChild(this.toggleButton);
    }
    if (this.notificationContainer) {
      document.body.removeChild(this.notificationContainer);
    }
    this.hideAllNotifications();
    this.guideManager.destroy();
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  public isWidgetVisible(): boolean {
    return this.isVisible;
  }

  public hideWidgetTemporarily(): void {
    if (this.iframeWrapper && this.isVisible) {
      this.iframeWrapper.classList.add("temporarily-hidden");
    }
  }

  public showWidgetAfterAnimation(): void {
    if (this.iframeWrapper) {
      this.iframeWrapper.classList.remove("temporarily-hidden");
    }
  }

  private async takeScreenshot(): Promise<void> {
    const { domToPng, createContext } = await import("modern-screenshot");
    this.screenshotContext ??= await createContext(document.body, {
      workerUrl: screenshotWorkerUrl,
      workerNumber: 1,
      filter: (node) => !(node instanceof HTMLElement && node.className.startsWith("helper-widget")),
    });
    try {
      const screenshot = await domToPng(this.screenshotContext);
      this.sendMessageToEmbed({ action: "SCREENSHOT", content: screenshot });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to take screenshot:", error);
      this.sendMessageToEmbed({ action: "SCREENSHOT", content: null });
    }
  }

  public static show(): void {
    if (HelperWidget.instance) {
      HelperWidget.instance.ensureDOMIntegrity();
      HelperWidget.instance.showInternal();
    }
  }

  public static hide(): void {
    if (HelperWidget.instance) {
      HelperWidget.instance.ensureDOMIntegrity();
      HelperWidget.instance.hideInternal();
    }
  }

  public static toggle(): void {
    if (HelperWidget.instance) {
      HelperWidget.instance.ensureDOMIntegrity();
      HelperWidget.instance.toggleInternal();
    }
  }

  public static minimize(): void {
    if (HelperWidget.instance) {
      HelperWidget.instance.minimizeInternal();
    }
  }

  public static maximize(): void {
    if (HelperWidget.instance) {
      HelperWidget.instance.maximizeInternal();
    }
  }

  public static toggleMinimize(): void {
    if (HelperWidget.instance) {
      HelperWidget.instance.toggleMinimize();
    }
  }

  public static sendPrompt(prompt: string | null): void {
    if (HelperWidget.instance) {
      HelperWidget.instance.ensureDOMIntegrity();
      HelperWidget.instance.sendPromptToEmbed(prompt);
      HelperWidget.instance.showInternal();
    }
  }

  public static startGuide(prompt: string): void {
    if (HelperWidget.instance) {
      HelperWidget.instance.ensureDOMIntegrity();
      HelperWidget.instance.startGuideInternal(prompt);
    }
  }

  public static async init(config: HelperWidgetConfig): Promise<HelperWidget> {
    if (!HelperWidget.instance) {
      HelperWidget.instance = new HelperWidget(config);
      await HelperWidget.instance.setup();
    }
    return HelperWidget.instance;
  }

  public static destroy(): void {
    if (HelperWidget.instance) {
      HelperWidget.instance.destroyInternal();
      HelperWidget.instance = null;
    }
  }

  private createNotificationContainer(): void {
    if (!this.notificationContainer) {
      this.notificationContainer = document.createElement("div");
      this.notificationContainer.className = "notification-container";
      if (this.showWidget) {
        this.notificationContainer.classList.add("with-widget");
      }
      document.body.appendChild(this.notificationContainer);
    }
  }

  private createNotificationBubble(id: string): HTMLDivElement {
    const bubble = document.createElement("div");
    bubble.className = "notification-bubble";

    const messageDiv = document.createElement("div");
    messageDiv.className = "message";
    bubble.appendChild(messageDiv);

    const closeButton = document.createElement("button");
    closeButton.className = "close-button";
    closeButton.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 2.5L9.5 9.5M2.5 9.5L9.5 2.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    bubble.appendChild(closeButton);

    this.notificationContainer?.appendChild(bubble);

    return bubble;
  }

  private async updateNotificationStatus(notificationId: number, status: "read" | "dismissed"): Promise<void> {
    try {
      await fetch(`${scriptOrigin}/api/widget/notification/${notificationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.sessionToken}`,
        },
        body: JSON.stringify({ status }),
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to update notification status:", error);
    }
  }

  private showNotification(message: string, conversationSlug: string, notificationId: number): void {
    this.ensureDOMIntegrity();
    
    let bubble = this.notificationBubbles.get(conversationSlug);
    if (!bubble) {
      bubble = this.createNotificationBubble(conversationSlug);
      this.notificationBubbles.set(conversationSlug, bubble);
    }

    if (this.helperIcon) {
      this.helperIcon.classList.add("has-notification");
    }

    const messageDiv = bubble.querySelector(".message");
    if (messageDiv) {
      messageDiv.textContent = message;
    }

    messageDiv?.addEventListener("click", () => {
      void this.updateNotificationStatus(notificationId, "read");

      this.hideNotification(conversationSlug);
      HelperWidget.show();
      this.sendMessageToEmbed({ action: "OPEN_CONVERSATION", content: { conversationSlug } });
    });

    const closeButton = bubble.querySelector(".close-button");
    closeButton?.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.updateNotificationStatus(notificationId, "dismissed");
      this.hideNotification(conversationSlug);
    });

    // Add small delay before showing for animation
    setTimeout(() => {
      bubble.classList.add("visible");
    }, 100);
  }

  private hideNotification(conversationSlug: string): void {
    const bubble = this.notificationBubbles.get(conversationSlug);
    if (bubble) {
      bubble.classList.remove("visible");
      bubble.classList.add("hiding");
      // Remove the bubble after animation
      setTimeout(() => {
        bubble.remove();
        this.notificationBubbles.delete(conversationSlug);

        // Remove has-notification class if no more notifications
        if (this.helperIcon && this.notificationBubbles.size === 0) {
          this.helperIcon.classList.remove("has-notification");
        }
      }, 300);
    }
  }

  private hideAllNotifications(): void {
    this.notificationBubbles.forEach((_bubble, conversationSlug) => {
      this.hideNotification(conversationSlug);
    });
  }

  private isAnonymous(): boolean {
    return !this.config.email;
  }
}

export default HelperWidget;

if (typeof window !== "undefined" && !window.document.currentScript?.dataset.delayInit) {
  HelperWidget.init(window.helperWidgetConfig || {});
}
