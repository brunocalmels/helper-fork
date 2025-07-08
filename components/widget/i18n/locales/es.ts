import { WidgetTranslations } from "../types";

export const es: WidgetTranslations = {
  ui: {
    // Widget title
    supportAndHelp: "Soporte y Ayuda",

    // Header actions
    newConversation: "Nueva conversación",
    history: "Historial",
    minimize: "Minimizar",
    maximize: "Maximizar",
    closeChat: "Cerrar chat",

    // Input and interaction
    askQuestion: "Hacer una pregunta",
    stop: "Detener",
    dictate: "Dictar",
    includeScreenshot: "¿Incluir una captura de pantalla para mejor soporte?",
    clearHistory: "Borrar historial",

    // Status messages
    noPreviousConversations: "No se encontraron conversaciones anteriores",

    // Loading and states
    loading: "Cargando...",
  },

  placeholders: {
    askQuestion: "Haz una pregunta...",
    provideDetails: "Proporciona detalles adicionales...",
  },

  ariaLabels: {
    startNewConversation: "Iniciar nueva conversación",
    showPreviousConversations: "Mostrar conversaciones anteriores",
    minimizeWidget: "Minimizar",
    maximizeWidget: "Maximizar",
    closeChat: "Cerrar chat",
    askQuestion: "Hacer una pregunta",
    stopDictation: "Detener",
    startDictation: "Dictar",
  },

  commands: {
    // Commands that close the widget
    close: [
      "salir",
      "cancelar",
      "cerrar",
      "parar",
      "terminar",
      "fin",
      "adiós",
      "salir del chat",
      "salir de este chat",
      "cerrar este chat",
      "cerrar chat",
      // Also support English commands for international users
      "exit",
      "cancel",
      "close",
      "stop",
      "quit",
      "end",
      "bye",
    ],

    // Keywords that trigger screenshot suggestion
    screenshotTriggers: [
      "error",
      "no puedo",
      "mal",
      "problema",
      "problemas",
      "falla",
      "fallo",
      "bug",
      "roto",
      "no funciona",
      "no carga",
      "no se carga",
      "crash",
      "cuelga",
      "falla",
      "fallido",
      "perdido",
      "no encuentro",
      "no veo",
      "no muestra",
      "no se muestra",
      "no está funcionando",
      "incorrecto",
      "inesperado",
      "extraño",
      "raro",
      "ayúdame",
      "confundido",
      "confundida",
      "404",
      "500",
      "no responde",
      "lento",
      "se cuelga",
      "captura",
      "pantallazo",
      // Also include English keywords for international users
      "error",
      "I can't",
      "wrong",
      "trouble",
      "problem",
      "issue",
      "bug",
      "broken",
      "screenshot",
    ],
  },
};
