# Guardian Dashboard Responsive Design Guidelines

## Overview
This document outlines the standardized responsive design protocols for the Immunicare Guardian Dashboard, ensuring consistent cross-device compatibility and seamless user experience.

## Spacing Standards

### Horizontal Padding Protocol
| Breakpoint | Range | Padding (px) | Tailwind Class |
|------------|-------|--------------|-----------------|
| Mobile | < 640px | 12px (3*4) | `px-3` |
| Tablet | 640-768px | 16px (4*4) | `px-4` |
| Desktop | 768-1024px | 20px (5*4) | `px-5` |
| Large Desktop | > 1024px | 24px (6*4) | `px-6` |

### Vertical Spacing Protocol
| Element | Mobile | Tablet | Desktop | Large |
|---------|--------|--------|---------|-------|
| Page Content | 16px (space-y-4) | 20px (space-y-5) | 24px (space-y-6) | 24px |
| Section Gap | 12px | 16px | 20px | 24px |
| Card Padding | 16px | 20px | 24px | 24px |

### Grid Spacing
- **Mobile**: 1 column, gap-4 (16px)
- **Tablet**: 2 columns, gap-4 (16px)
- **Desktop**: 3-4 columns, gap-4-6 (16-24px)

## Touch Target Standards
- Minimum touch target: 44x44px (WCAG 2.5.5)
- Button padding: 12px horizontal, 8px vertical minimum
- Icon buttons: 44x44px minimum with proper focus states

## Component Standards

### Header
```jsx
// Standard header padding
className="px-3 sm:px-4 md:px-5 lg:px-6 py-3"
```

### Cards
```jsx
// Standard card with responsive padding
className="p-4 sm:p-5 md:p-6 rounded-xl"
```

### Buttons
```jsx
// Primary action button
className="px-4 py-2 min-h-[44px] text-sm sm:text-base"
```

### Forms
```jsx
// Form field spacing
className="space-y-4"

// Grid form layout
className="grid grid-cols-1 sm:grid-cols-2 gap-4"
```

## Real-time Synchronization

### Socket Events for Guardian-Admin Sync
The following socket events enable real-time data synchronization:

- `appointment-created` - New appointment booked
- `appointment-updated` - Appointment modified
- `appointment-cancelled` - Appointment cancelled
- `vaccination-recorded` - Vaccination record added
- `vaccination-updated` - Vaccination record modified
- `guardian-data-changed` - Guardian profile updated
- `child-data-changed` - Child data modified

### Listening for Updates
```javascript
// In React components
useEffect(() => {
  const handleAppointmentUpdate = (e) => {
    const { action, ...data } = e.detail;
    // Handle the update
  };
  
  window.addEventListener('appointment-update', handleAppointmentUpdate);
  return () => window.removeEventListener('appointment-update', handleAppointmentUpdate);
}, []);
```

## Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Testing Breakpoints
| Device | Width | Height | Viewport |
|--------|-------|--------|----------|
| Mobile S | 320px | 568px | iPhone SE |
| Mobile M | 375px | 667px | iPhone 12 |
| Mobile L | 414px | 896px | iPhone 12 Max |
| Tablet | 768px | 1024px | iPad |
| Laptop | 1280px | 800px | MacBook |
| Desktop | 1920px | 1080px | Full HD |

## Best Practices

1. **Always use responsive prefixes**: `sm:`, `md:`, `lg:`, `xl:`
2. **Test at all breakpoints**: Don't assume mobile-first works without testing
3. **Use CSS custom properties**: Leverage design-tokens.css for consistency
4. **Consider touch targets**: 44px minimum for all interactive elements
5. **Safe area insets**: Use `env(safe-area-inset-bottom)` for notched devices

### Files Using Standardized Responsive Classes
1. `GuardianLayout.jsx` - Main layout wrapper with sidebar/bottom nav
2. `GuardianDashboard.jsx` - Header, stats grid, quick actions, two-column layout
3. `MyChildren.jsx` - Header, children grid, modal spacing
4. `GuardianAppointmentsPage.jsx` - Calendar layout, sidebar, main content
5. `guardian-responsive.css` - Unified responsive CSS file (NEW)

## Migration Notes

### Legacy Classnames to Replace
- `p-4` → `p-4 sm:p-5 md:p-6` (for consistent card padding)
- `gap-3` → `gap-4` (standardized gap)
- `space-y-4` → `space-y-4 md:space-y-5 lg:space-y-6`
- `px-3 sm:px-4 md:px-6 lg:px-8` → `px-4 sm:px-5 md:px-6 lg:px-8` (standardized progression)

### Files Modified
1. `GuardianDashboard.jsx` - Header, stats grid, quick actions, two-column layout
2. `MyChildren.jsx` - Header, children grid, modal spacing
3. `GuardianAppointmentsPage.jsx` - Calendar layout, sidebar, main content
4. `GuardianLayout.jsx` - Content area padding
5. `SocketContext.jsx` - Real-time sync events
6. `guardian-responsive.css` - NEW unified responsive CSS file

## Mobile Performance Budgets

### WebSocket Performance
| Metric | Target | Priority |
|--------|--------|----------|
| Connection Latency | < 1000ms | High |
| Event Propagation | < 3000ms | High |
| Reconnection Time | < 8000ms | Critical |

### Page Load Performance
| Metric | Target | Device |
|--------|--------|--------|
| First Contentful Paint | < 1500ms | Mobile |
| Largest Contentful Paint | < 2500ms | Mobile |
| Time to Interactive | < 3000ms | Mobile |
| Total Blocking Time | < 300ms | Mobile |

### Network Optimization
- Lazy load images below fold
- Code split per route
- Minimize JavaScript bundle < 200KB (gzipped)
- Use WebP images with fallback

### Mobile Breakpoint Targets (<640px)
| WebSocket Event | Target Latency | Status |
|-----------------|----------------|--------|
| Connection | < 1000ms | Required |
| vaccination-recorded | < 3000ms | Required |
| vaccination-updated | < 3000ms | Required |
| child-data-changed | < 3000ms | Required |
| guardian-data-changed | < 3000ms | Required |

## Version History
- v1.2 (2026-03-03) - Added mobile performance budgets and WebSocket targets
- v1.1 (2026-03-03) - Added standardized spacing values, unified CSS file
- v1.0 (2026-03-03) - Initial responsive design guidelines
