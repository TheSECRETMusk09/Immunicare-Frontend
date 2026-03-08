# Immunicare CSS Architecture

This document describes the modular CSS architecture for the Immunicare Vaccination Management System.

## Directory Structure

```
frontend/src/css/
├── index.css         # Main entry point - imports all modules
├── variables.css     # CSS variables & design tokens
├── reset.css         # Base reset & normalization
├── utilities.css     # Utility classes
├── components.css    # Component-specific styles
├── pages.css         # Page-specific styles
├── layouts.css       # Layout-specific styles
├── animations.css    # Animations & transitions
├── responsive.css    # Responsive design system
├── offline.css       # Offline support & PWA styles
└── README.md         # This file
```

## Import Order

The CSS modules must be imported in the following order:

1. **variables.css** - CSS variables & design tokens (must be first)
2. **reset.css** - Base reset & normalization
3. **utilities.css** - Utility classes
4. **components.css** - Component-specific styles
5. **pages.css** - Page-specific styles
6. **layouts.css** - Layout-specific styles
7. **animations.css** - Animations & transitions
8. **responsive.css** - Responsive design system
9. **offline.css** - Offline support & PWA styles

## CSS Variables

The design system uses CSS custom properties for consistent theming:

### Colors

- `--color-primary-*` - Primary brand colors (50-900)
- `--color-secondary-*` - Secondary/accent colors (50-900)
- `--color-warning-*` - Warning/alert colors (50-900)
- `--color-danger-*` - Error/danger colors (50-900)
- `--color-neutral-*` - Neutral grays (0-950)

### Typography

- `--font-family-sans` - Primary font family
- `--font-family-mono` - Monospace font family
- `--font-size-*` - Font size scale (xs to 5xl)
- `--font-weight-*` - Font weight scale
- `--line-height-*` - Line height values

### Spacing

- `--space-*` - Spacing scale (0 to 24)
- Used for margins, padding, gaps

### Borders

- `--radius-*` - Border radius scale
- `--shadow-*` - Box shadow scale

### Transitions

- `--transition-fast` - 150ms transition
- `--transition-normal` - 300ms transition
- `--transition-slow` - 500ms transition

## Utility Classes

The utility classes follow a consistent naming pattern:

- **Display**: `.flex`, `.grid`, `.hidden`, `.block`, etc.
- **Flexbox**: `.flex-col`, `.items-center`, `.justify-between`, `.gap-4`, etc.
- **Grid**: `.grid-cols-3`, `.gap-x-4`, `.gap-y-6`, etc.
- **Spacing**: `.p-4`, `.m-4`, `.px-4`, `.py-4`, `.mt-4`, `.mb-4`, etc.
- **Typography**: `.text-lg`, `.font-bold`, `.text-center`, `.uppercase`, etc.
- **Colors**: `.text-primary`, `.bg-secondary`, `.border`, etc.
- **Effects**: `.shadow-lg`, `.rounded-xl`, `.opacity-50`, etc.

## Offline Support

The CSS includes offline support through:

- **offline.css** - Styles for offline indicators and fallback content
- **Service Worker** - Caches CSS for offline use
- **Network status detection** - Visual feedback for offline state

## Responsive Design

The responsive system uses the following breakpoints:

- **sm**: max-width: 640px
- **md**: 641px - 1024px
- **lg**: 1025px - 1280px
- **xl**: 1281px and above

Example responsive utility classes:

- `.sm:flex-col` - Column layout on small screens
- `.md:grid-cols-3` - 3-column grid on medium screens
- `.lg:hidden` - Hidden on large screens

## Accessibility

The CSS includes accessibility features:

- **Focus indicators**: `*:focus-visible` styles
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)`
- **High contrast**: `@media (prefers-contrast: high)`
- **Touch targets**: Minimum 44x44px touch targets
- **Screen reader support**: `.sr-only` class

## Dark Mode

Dark mode is supported through:

- CSS custom properties that change on `[data-theme="dark"]` or `@media (prefers-color-scheme: dark)`
- Automatic detection of system preference

## Migration Guide

To migrate existing styles to this architecture:

1. Identify if the style is a design token → add to `variables.css`
2. Identify if it's a reusable utility → add to `utilities.css`
3. Identify if it's component-specificcomponents.css`4 → add to`. Identify if it's page-specific → add to `pages.css`
4. Identify if it's a layout pattern → add to `layouts.css`
5. Identify if it's an animation → add to `animations.css`

## Best Practices

1. Use CSS variables instead of hardcoded values
2. Use utility classes for common patterns
3. Keep component styles scoped to specific components
4. Avoid inline styles - use CSS classes instead
5. Use responsive utilities for mobile-first design
6. Test with reduced motion enabled
7. Ensure sufficient color contrast (WCAG AA minimum)

## Browser Support

- Chrome 88+
- Firefox 78+
- Safari 14+
- Edge 88+
- iOS Safari 14+
- Android Chrome 88+

## Performance

- CSS is modular and tree-shakeable
- No unused styles in production builds
- Critical CSS is inlined
- Non-critical CSS is lazy-loaded
- Animations use `transform` and `opacity` for GPU acceleration
