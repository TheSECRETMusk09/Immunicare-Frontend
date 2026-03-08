# Guardian Dashboard Dark Mode - Implementation Guidelines

## Overview
This document outlines the architecture and best practices for implementing dark mode across the Guardian dashboard. It provides guidance for developers to maintain consistent dark mode styling and prevent future inconsistencies.

---

## Architecture Overview

### Theme System Components

1. **CSS Custom Properties** - Theme tokens defined in `guardian-dark-mode-comprehensive.css`
2. **Tailwind Dark Mode Classes** - Component-level dark mode styling
3. **Layout Integration** - CSS file imported in `GuardianLayout.jsx`

### Theme Tokens

The theme system uses CSS custom properties (CSS variables) for centralized color management:

```css
:root {
  /* Light Mode (Default) */
  --theme-bg-primary: #ffffff;
  --theme-bg-secondary: #f9fafb;
  --theme-bg-tertiary: #f3f4f6;
  --theme-text-primary: #111827;
  --theme-text-secondary: #4b5563;
  --theme-text-muted: #9ca3af;
  --theme-border: #e5e7eb;
  --theme-accent: #10b981;
  --theme-accent-hover: #059669;
}

[data-theme="dark"] {
  /* Dark Mode */
  --theme-bg-primary: #111827;
  --theme-bg-secondary: #1f2937;
  --theme-bg-tertiary: #374151;
  --theme-text-primary: #f9fafb;
  --theme-text-secondary: #d1d5db;
  --theme-text-muted: #9ca3af;
  --theme-border: #374151;
  --theme-accent: #10b981;
  --theme-accent-hover: #34d399;
}
```

---

## Implementation Patterns

### Pattern 1: CSS Custom Properties (Recommended for Complex Components)

Use CSS custom properties when you need to apply the same color across multiple elements:

```css
/* Example: Card component */
.theme-card {
  background-color: var(--theme-bg-primary);
  border-color: var(--theme-border);
  color: var(--theme-text-primary);
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
```

```jsx
<div className="theme-card">
  Content here
</div>
```

### Pattern 2: Tailwind Dark Mode Classes (Recommended for Most Components)

Use Tailwind's dark mode variant for component-specific styling:

```jsx
// Basic card pattern
<div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl">
  <h3 className="text-gray-900 dark:text-white">Title</h3>
  <p className="text-gray-600 dark:text-gray-400">Description</p>
</div>
```

### Pattern 3: Combining Both Patterns

For maximum flexibility and consistency:

```jsx
<div className="theme-card bg-white dark:bg-gray-800">
  <h3 className="text-gray-900 dark:text-white font-semibold">
    {title}
  </h3>
  <p className="text-gray-600 dark:text-gray-400">
    {description}
  </p>
</div>
```

---

## Component Guidelines

### Cards

Always include both light and dark mode classes:

```jsx
// ✅ Correct
<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
  Content
</div>

// ❌ Wrong - missing dark mode
<div className="bg-white border border-gray-200 rounded-xl shadow-sm">
  Content
</div>
```

### Text

Use appropriate text color classes:

| Light Mode | Dark Mode | Usage |
|------------|-----------|-------|
| `text-gray-900` | `dark:text-white` | Primary headings |
| `text-gray-700` | `dark:text-gray-300` | Body text |
| `text-gray-500` | `dark:text-gray-400` | Secondary text |
| `text-gray-400` | `dark:text-gray-500` | Placeholder text |

### Buttons

```jsx
// Primary button
<button className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white">
  Action
</button>

// Secondary button
<button className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">
  Cancel
</button>
```

### Form Inputs

```jsx
<input 
  className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-emerald-500 focus:border-emerald-500"
  placeholder="Enter value"
/>
```

### Navigation

```jsx
<nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
  <a className="text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400">
    Link
  </a>
</nav>
```

---

## Common Patterns to Avoid

### 1. Hardcoded Colors

```jsx
// ❌ Wrong - hardcoded color
<div style={{ backgroundColor: '#ffffff' }}>

// ✅ Correct - use CSS classes
<div className="bg-white dark:bg-gray-800">
```

### 2. Incomplete Dark Mode

```jsx
// ❌ Wrong - missing dark mode for one state
<div className="bg-gray-50">  // always light

// ✅ Correct - both modes specified
<div className="bg-gray-50 dark:bg-gray-800">
```

### 3. Missing Transitions

```jsx
// ❌ Wrong - jarring color change
<div className="bg-white dark:bg-gray-800">

// ✅ Correct - smooth transition
<div className="bg-white dark:bg-gray-800 transition-colors duration-300">
```

### 4. Ignoring System Preference

```jsx
// ❌ Wrong - only respects manual toggle
<div className="bg-white dark:bg-gray-800">

// ✅ Correct - respects system preference
// This works automatically with Tailwind's dark mode configuration
// when configured with 'class' strategy
```

---

## Theme Configuration

### Tailwind Configuration

Ensure your `tailwind.config.js` is configured for class-based dark mode:

```javascript
module.exports = {
  darkMode: 'class',  // or 'media' for system preference only
  // ... rest of config
}
```

### System Preference Detection

For automatic system preference detection:

```javascript
// Check system preference on mount
useEffect(() => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleChange = (e) => {
    // Update theme based on system preference
    if (e.matches) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };
  
  mediaQuery.addEventListener('change', handleChange);
  
  return () => mediaQuery.removeEventListener('change', handleChange);
}, []);
```

---

## Accessibility Guidelines

### Color Contrast

Ensure minimum contrast ratios (WCAG 2.1 AA):
- **4.5:1** for normal text
- **3:1** for large text (18pt+)
- **3:1** for UI components

Use these color combinations:

| Background | Light Text | Dark Text | Passes AA? |
|------------|------------|-----------|------------|
| `#ffffff` | `#111827` | - | ✅ |
| `#1f2937` | - | `#f9fafb` | ✅ |
| `#10b981` | `#ffffff` | - | ✅ |

### High Contrast Mode

Support users who need higher contrast:

```css
@media (prefers-contrast: more) {
  :root {
    --theme-border: #000000;
    --theme-text-primary: #000000;
  }
  
  [data-theme="dark"] {
    --theme-border: #ffffff;
    --theme-text-primary: #ffffff;
  }
}
```

### Reduced Motion

Respect users who prefer reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Testing Checklist

Before committing any changes, verify:

- [ ] Component renders correctly in light mode
- [ ] Component renders correctly in dark mode
- [ ] No hardcoded colors used
- [ ] Smooth transitions (300ms) between themes
- [ ] No layout shifts during theme change
- [ ] Accessible color contrast ratios
- [ ] Works with system dark mode preference
- [ ] Works in all target browsers

---

## File Structure

```
frontend/src/
├── css/
│   ├── guardian-dark-mode-comprehensive.css    # Theme variables and global styles
│   ├── guardian-dark-mode-test-checklist.md    # Test checklist
│   └── guardian-dark-mode-implementation-guide.md # This file
├── components/
│   ├── GuardianLayout.jsx                       # Imports dark mode CSS
│   ├── GuardianSidebar.jsx                      # Uses dark mode classes
│   └── GuardianDashboard.jsx                    # Uses dark mode classes
└── pages/
    ├── GuardianDashboard.jsx
    ├── GuardianAppointmentsPage.jsx
    ├── GuardianChildrenPage.jsx
    ├── GuardianNotificationsPage.jsx
    └── Profile.jsx
```

---

## Troubleshooting

### Theme not switching?

1. Check `tailwind.config.js` has `darkMode: 'class'`
2. Verify CSS file is imported in layout
3. Check browser console for errors
4. Verify `dark` class is being added to `<html>`

### Flickering on page load?

1. Add theme detection script in `<head>` before React loads
2. Use CSS custom properties with proper fallbacks
3. Check for FOUC (Flash of Unstyled Content)

### Colors not matching design?

1. Check color contrast ratios
2. Verify custom properties are CSS being applied
3. Check for style specificity issues

---

## Resources

- [Tailwind Dark Mode Documentation](https://tailwindcss.com/docs/dark-mode)
- [WCAG 2.1 Color Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)

---

## Maintenance

When adding new components:
1. Always include dark mode classes
2. Test in both light and dark modes
3. Use the CSS custom properties where possible
4. Document any new color tokens

When modifying existing components:
1. Check dark mode still works
2. Verify no hardcoded colors introduced
3. Run regression tests

---

**Last Updated:** 2026-03-02  
**Version:** 1.0  
**Maintainer:** Frontend Team
