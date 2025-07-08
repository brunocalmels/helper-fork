# Widget Internationalization (i18n) System

A lightweight, type-safe internationalization system for the Helper chat widget.

## Overview

This system provides internationalization support for the Helper chat widget with:

- **Type-safe translations** with full TypeScript support
- **Minimal bundle size** - no external dependencies
- **Fallback support** to English for missing translations
- **React Context** for easy integration
- **Modular architecture** for easy extension

## Quick Start

### Basic Usage

```tsx
import { WidgetI18nProvider, useWidgetTranslations } from '../i18n'

// Wrap your widget components
<WidgetI18nProvider config={{ locale: 'es' }}>
  <YourWidgetComponent />
</WidgetI18nProvider>

// Use translations in components
const YourWidgetComponent = () => {
  const { t } = useWidgetTranslations()
  
  return (
    <button>{t('ui.newConversation')}</button>
  )
}
```

### SDK Integration

Users can specify locale in the widget configuration:

```javascript
window.helperWidgetConfig = {
  mailboxSlug: 'your-mailbox',
  locale: 'es' // Spanish
}
```

## Translation Structure

Translations are organized in a nested structure:

```typescript
{
  ui: {
    newConversation: 'Nueva conversación',
    closeChat: 'Cerrar chat',
    // ... other UI strings
  },
  placeholders: {
    askQuestion: 'Haz una pregunta...',
    // ... other placeholders
  },
  ariaLabels: {
    startNewConversation: 'Iniciar nueva conversación',
    // ... other aria labels
  },
  commands: {
    close: ['salir', 'cerrar', 'cancelar'],
    screenshotTriggers: ['error', 'problema', 'falla'],
  }
}
```

## API Reference

### `WidgetI18nProvider`

Provider component that makes translations available to child components.

```tsx
<WidgetI18nProvider config={{ locale: 'es' }}>
  {children}
</WidgetI18nProvider>
```

**Props:**
- `config.locale` - The locale to use (optional, defaults to 'en')

### `useWidgetTranslations()`

Hook that provides translation functions and current locale.

```tsx
const { t, locale, translations } = useWidgetTranslations()
```

**Returns:**
- `t(key)` - Translation function with type safety
- `locale` - Current locale code
- `translations` - Raw translation object

### `useWidgetCommands()`

Convenience hook for accessing command arrays.

```tsx
const { closeCommands, screenshotTriggers } = useWidgetCommands()
```

## Adding New Languages

### Step 1: Create Translation File

Create a new file in `locales/` (e.g., `es.ts`):

```typescript
import { WidgetTranslations } from '../types'

export const es: WidgetTranslations = {
  ui: {
    newConversation: 'Nueva conversación',
    // ... translate all keys
  },
  // ... complete all sections
}
```

### Step 2: Update Locale Registry

Add the new locale to `locales/index.ts`:

```typescript
import { es } from './es'

export const locales: Record<SupportedLocale, WidgetTranslations> = {
  en,
  es, // Add here
  // ...
}
```

### Step 3: Update Types

Add the new locale to `types.ts`:

```typescript
export type SupportedLocale = 'en' | 'es' | 'fr' // Add new locale
```

## Type Safety

The system provides full TypeScript support:

```typescript
// ✅ Valid translation keys (with autocomplete)
t('ui.newConversation')
t('placeholders.askQuestion')
t('ariaLabels.closeChat')

// ❌ Invalid keys (TypeScript error)
t('ui.nonExistent')
t('invalid.key')
```

## Best Practices

1. **Always provide English fallback** - Never leave English translations empty
2. **Use semantic keys** - `ui.newConversation` not `button1`
3. **Test with long text** - Some languages need more space
4. **Consider cultural context** - Not just literal translations
5. **Include common English terms** - For international users

## Contributing

When adding new translatable strings:

1. Add to English locale first (`en.ts`)
2. Update TypeScript types if needed
3. Add to other locales or mark as TODO
4. Test type safety and fallbacks

## File Structure

```
components/widget/i18n/
├── index.ts              # Main exports and hooks
├── types.ts              # TypeScript definitions
├── locales/
│   ├── index.ts          # Locale registry
│   ├── en.ts             # English translations
│   └── es.ts             # Spanish translations (example)
├── example.tsx           # Usage examples
└── README.md             # This file
``` 