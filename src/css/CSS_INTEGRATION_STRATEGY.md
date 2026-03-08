# CSS Integration Strategy

## Immunicare Vaccination Management System

This document outlines the hybrid approach for integrating Tailwind CSS v3 with custom CSS in the Immunicare application.

## Overview

The system uses a **hybrid CSS architecture** that combines:

1. **Tailwind CSS** for utility-first styling and rapid development
2. **Custom CSS (BEM methodology)** for component-specific styles and complex layouts
3. **CSS Custom Properties (Design Tokens)** for theming and consistency

## Integration Strategy

### 1. Tailwind CSS Usage

Tailwind should be used for:

- Layout utilities (flexbox, grid, spacing)
- Typography (font size, weight, line height)
- Colors (backgrounds, text, borders)
- Responsive design (breakpoint prefixes)
- Interactive states (hover, focus, active)
- Animation utilities

#### Example:

```jsx
<button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 transition-colors">
  Submit
</button>
```

### 2. Custom CSS Usage

Custom CSS should be used for:

- Complex component patterns (cards, modals, sidebars)
- BEM-style component architecture
- Component-specific animations
- Theming with CSS custom properties
- Legacy component styles

#### Example:

```jsx
<div className="card card-elevated">
  <div className="card-header">
    <h3 className="card-title">Dashboard</h3>
  </div>
  <div className="card-body">Content here</div>
</div>
```

### 3. Design Tokens Integration

CSS custom properties are defined in `variables.css` and can be used alongside Tailwind:

```css
.card {
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
}

/* Tailwind config maps to these variables */
.theme-bg-primary {
  background-color: var(--color-bg-primary);
}
```

### 4. Component Class Naming Convention

#### BEM Naming:

- **Block**: `.card`, `.sidebar`, `.modal`
- **Element**: `.card__header`, `.card__title`, `.card__body`
- **Modifier**: `.card--elevated`, `.card--outlined`, `.card--flat`

#### Tailwind + BEM Hybrid:

```jsx
<div className="card card--elevated p-6 hover:shadow-lg transition-shadow">
  <h3 className="card__title text-xl font-semibold">Title</h3>
</div>
```

### 5. Responsive Design Strategy

#### Mobile-First Approach:

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {/* Cards adapt to screen size */}
</div>
```

#### Breakpoint System:

- `xs`: 320px (small phones)
- `sm`: 640px (phones)
- `md`: 768px (tablets)
- `lg`: 1024px (small laptops)
- `xl`: 1280px (desktops)
- `2xl`: 1536px (large screens)

### 6. Dark Mode Implementation

#### Using Tailwind:

```jsx
<div className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
  Content
</div>
```

#### Using CSS Variables:

```css
.card {
  background-color: var(--color-bg-primary);
}

[data-theme="dark"] .card {
  background-color: var(--color-bg-primary);
}
```

### 7. Animation & Transitions

#### Tailwind Animation Classes:

```jsx
<div className="animate-fade-in animate-slide-up hover:scale-105 transition-transform">
  Animated content
</div>
```

#### Custom Animation Classes:

```jsx
<div className="hover-lift hover-shadow-lg">Content with hover effects</div>
```

### 8. State Management

#### Focus States:

```jsx
<button className="focus-ring focus-visible:ring-2 focus-visible:ring-primary-500">
  Accessible button
</button>
```

#### Loading States:

```jsx
<button className="loading" disabled>
  <span className="spinner"></span>
  Loading...
</button>
```

### 9. Form Validation Styling

```jsx
<input
  className={`input-field ${hasError ? 'has-error' : ''}`}
  aria-invalid={hasError}
/>
<span className="input-error">{errorMessage}</span>
```

### 10. Print Styles

Print styles are defined in `print-styles.css` and handle:

- Hiding navigation and interactive elements
- Adjusting colors for print
- Page breaks for documents
- Removing backgrounds

## File Structure

```
frontend/src/
├── css/
│   ├── index.css              # Main entry point
│   ├── variables.css          # Design tokens
│   ├── components.css         # Component styles (BEM)
│   ├── additional-components.css  # Additional UI components
│   ├── pages-comprehensive.css    # Page-specific styles
│   ├── animations.css         # Animations & transitions
│   ├── responsive.css         # Responsive utilities
│   └── ...
├── components/
│   └── UI/
│       ├── Button.jsx
│       ├── Card.jsx
│       └── ...
└── App.jsx
```

## Best Practices

### DO:

- ✅ Use Tailwind utilities for layout, spacing, and typography
- ✅ Use design tokens (CSS variables) for colors and theme values
- ✅ Create reusable component patterns with BEM
- ✅ Test responsive behavior at all breakpoints
- ✅ Implement accessibility from the start
- ✅ Use semantic HTML with appropriate ARIA attributes

### DON'T:

- ❌ Use arbitrary values extensively (use theme extension instead)
- ❌ Mix too many approaches in a single component
- ❌ Forget to test dark mode
- ❌ Ignore accessibility requirements
- ❌ Use inline styles

## Migration Strategy

### Phase 1: Foundation

- Configure Tailwind with design tokens
- Create component base styles
- Set up responsive system

### Phase 2: Components

- Migrate existing components to new system
- Create new component patterns
- Add missing components

### Phase 3: Pages

- Apply new styling to all pages
- Optimize for performance
- Test cross-browser compatibility

### Phase 4: Optimization

- Remove unused CSS (purge)
- Minify production CSS
- Document usage guidelines

## Performance Considerations

1. **Tailwind Purging**: Unused styles are automatically removed in production
2. **CSS Custom Properties**: Enable runtime theme switching
3. **Component Styles**: Scoped styles prevent conflicts
4. **Critical CSS**: Inline critical styles for faster FCP
5. **Lazy Loading**: Load non-critical CSS on demand

## Browser Support

- Chrome 88+
- Firefox 78+
- Safari 14+
- Edge 88+
- iOS Safari 14+
- Android Chrome 88+

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [MDN CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [BEM Methodology](http://getbem.com/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
