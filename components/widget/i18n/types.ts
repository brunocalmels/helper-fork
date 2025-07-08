export type WidgetTranslations = {
  ui: {
    // Widget title
    supportAndHelp: string;

    // Header actions
    newConversation: string;
    history: string;
    minimize: string;
    maximize: string;
    closeChat: string;

    // Input and interaction
    askQuestion: string;
    stop: string;
    dictate: string;
    includeScreenshot: string;
    clearHistory: string;

    // Status messages
    noPreviousConversations: string;

    // Loading and states
    loading: string;
  };

  placeholders: {
    askQuestion: string;
    provideDetails: string;
  };

  ariaLabels: {
    startNewConversation: string;
    showPreviousConversations: string;
    minimizeWidget: string;
    maximizeWidget: string;
    closeChat: string;
    askQuestion: string;
    stopDictation: string;
    startDictation: string;
  };

  commands: {
    // Commands that close the widget
    close: string[];
    // Keywords that trigger screenshot suggestion
    screenshotTriggers: string[];
  };
};

export type SupportedLocale = "en" | "es";

export type WidgetI18nConfig = {
  locale?: SupportedLocale;
  fallbackLocale?: SupportedLocale;
};
