import { WidgetTranslations } from "../types";

export const en: WidgetTranslations = {
  ui: {
    // Widget title
    supportAndHelp: "Support & Help",

    // Header actions
    newConversation: "New conversation",
    history: "History",
    minimize: "Minimize",
    maximize: "Maximize",
    closeChat: "Close chat",

    // Input and interaction
    askQuestion: "Ask a question",
    stop: "Stop",
    dictate: "Dictate",
    includeScreenshot: "Include a screenshot for better support?",
    clearHistory: "Clear history",

    // Status messages
    noPreviousConversations: "No previous conversations found",

    // Loading and states
    loading: "Loading...",
  },

  placeholders: {
    askQuestion: "Ask a question...",
    provideDetails: "Provide additional details...",
  },

  ariaLabels: {
    startNewConversation: "Start new conversation",
    showPreviousConversations: "Show previous conversations",
    minimizeWidget: "Minimize widget",
    maximizeWidget: "Maximize widget",
    closeChat: "Close chat",
    askQuestion: "Ask a question",
    stopDictation: "Stop",
    startDictation: "Dictate",
  },

  commands: {
    // Commands that close the widget
    close: [
      "exit",
      "cancel",
      "close",
      "stop",
      "quit",
      "end",
      "bye",
      "exit chat",
      "exit this chat",
      "close this chat",
      "close chat",
    ],

    // Keywords that trigger screenshot suggestion
    screenshotTriggers: [
      "error",
      "I can't",
      "wrong",
      "trouble",
      "problem",
      "issue",
      "glitch",
      "bug",
      "broken",
      "doesn't work",
      "doesn't load",
      "not loading",
      "crash",
      "stuck",
      "fails",
      "failure",
      "failed",
      "missing",
      "can't find",
      "can't see",
      "doesn't show",
      "not showing",
      "not working",
      "incorrect",
      "unexpected",
      "strange",
      "weird",
      "help me",
      "confused",
      "404",
      "500",
      "not responding",
      "slow",
      "hangs",
      "screenshot",
    ],
  },
};
