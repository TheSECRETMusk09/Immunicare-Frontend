# Guardian Dashboard Dark Mode - Regression Test Checklist

## Overview
This document contains the comprehensive regression test checklist for verifying dark mode implementation across the Guardian dashboard. All tests should be performed after any CSS or component changes.

---

## Test Environment Setup

### Prerequisites
- [ ] Browser developer tools available
- [ ] System dark mode preference can be toggled
- [ ] Test account with guardian role credentials

### Test Browsers
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if applicable)

### Test Viewports
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

---

## Core Theme Tests

### Theme Toggle Functionality
- [ ] Dark mode toggle switch is visible and accessible
- [ ] Clicking toggle switches between light/dark modes
- [ ] Theme preference persists after page refresh (localStorage)
- [ ] Theme preference syncs across multiple tabs
- [ ] No flash of wrong theme on page load (FOUC)

### System Preference Detection
- [ ] App detects system `prefers-color-scheme` preference on first visit
- [ ] System preference changes are detected without refresh
- [ ] Manual toggle overrides system preference

### Theme Transitions
- [ ] Smooth transition when switching themes (300ms)
- [ ] No visible flickering during transition
- [ ] No layout shifts during transition
- [ ] Animations respect `prefers-reduced-motion`

---

## Page-by-Page Tests

### 1. Dashboard Page (/guardian/dashboard)

#### Sidebar
- [ ] Sidebar background is `gray-900` in dark mode
- [ ] Sidebar text is `white` in dark mode
- [ ] Sidebar border is `gray-800` in dark mode
- [ ] User avatar section has proper dark background
- [ ] Menu icons have proper dark mode colors
- [ ] Active menu item has visible highlight in dark mode

#### Main Content Area
- [ ] Page header has proper dark background
- [ ] Welcome text is readable in dark mode
- [ ] Stats cards have dark backgrounds (`gray-800`)
- [ ] Stats card text is readable in dark mode
- [ ] Child cards have dark backgrounds
- [ ] Appointment cards have dark backgrounds
- [ ] Empty state has proper dark styling
- [ ] Error state has proper dark styling

### 2. My Children Page (/guardian/children)

#### Navigation
- [ ] Breadcrumb is visible in dark mode
- [ ] Back button is visible and styled correctly

#### Content Cards
- [ ] Child info cards have dark backgrounds
- [ ] Card headers have proper dark styling
- [ ] Card content is readable in dark mode
- [
- [ ] ] Action buttons are visible in dark mode Vaccination history is readable
- [ ] Add child button has proper dark styling

### 3. Appointments Page (/guardian/appointments)

#### Tabs (All, Upcoming, Completed, Cancelled)
- [ ] Tab buttons have dark backgrounds when active
- [ ] Tab text is readable in dark mode
- [ ] Tab hover states work in dark mode

#### Appointment Cards
- [ ] Card background is `gray-800` in dark mode
- [ ] Card border is `gray-700` in dark mode
- [ ] Appointment title is readable
- [ ] Date/time is readable
- [ ] Status badges have proper colors in dark mode
- [ ] Action buttons are visible

#### Filters & Dropdowns
- [ ] Filter dropdown has dark background
- [ ] Filter options have dark backgrounds
- [ ] Selected filter is visible

### 4. Notifications Page (/guardian/notifications)

#### Filter Tabs (All, Unread, Read)
- [ ] Tab background changes in dark mode
- [ ] Active tab is visually distinct
- [ ] Tab text is readable

#### Type Filter Dropdown
- [ ] Dropdown button has dark background
- [ ] Dropdown menu has dark background
- [ ] Selected option is visible
- [ ] Hover states work

#### Notification Cards
- [ ] Card background is dark in dark mode
- [ ] Unread indicator is visible
- [ ] Notification text is readable
- [ ] Timestamp is readable
- [ ] Action buttons are visible

### 5. Profile Page (/guardian/profile)

#### Profile Header
- [ ] Header background is dark in dark mode
- [ ] Profile picture area is styled correctly
- [ ] Edit button is visible

#### Info Cards
- [ ] PersonalInfoCard has dark background
- [ ] EmergencyContactCard has dark background
- [ ] AccountStatsCard has dark background
- [ ] QuickActionsCard has dark background
- [ ] Card headers have proper dark styling
- [ ] Card content text is readable
- [ ] Input fields have dark backgrounds
- [ ] Labels are readable

#### Modals
- [ ] Modal overlay is visible in dark mode
- [ ] Modal background is dark
- [ ] Modal text is readable
- [ ] Close button is visible

---

## Accessibility Tests

### Color Contrast (WCAG 2.1 AA)
- [ ] Primary text meets 4.5:1 contrast ratio
- [ ] Secondary text meets 4.5:1 contrast ratio
- [ ] Large text (18pt+) meets 3:1 contrast ratio
- [ ] UI components meet 3:1 contrast ratio

### High Contrast Mode
- [ ] Content is readable with `prefers-contrast: more`
- [ ] Borders are more prominent in high contrast
- [ ] Focus indicators are clearly visible

### Focus Management
- [ ] Focus ring is visible on all interactive elements
- [ ] Focus order is logical
- [ ] Tab navigation works correctly

### Screen Reader Compatibility
- [ ] Theme toggle has proper aria-label
- [ ] Status changes are announced
- [ ] All images have alt text

---

## Performance Tests

### Theme Switching
- [ ] Theme switches within 100ms
- [ ] No jank or stutter during transition
- [ ] No layout recalculation causing shifts

### Initial Load
- [ ] No flash of unstyled content (FOUC)
- [ ] Theme loads before paint where possible

---

## Browser-Specific Tests

### Chrome/Edge
- [ ] All tests pass in Chrome
- [ ] All tests pass in Edge
- [ ] DevTools theme matches system preference

### Firefox
- [ ] All tests pass in Firefox
- [ ] Theme preference detection works

### Safari (if applicable)
- [ ] All tests pass in Safari
- [ ] Smooth transitions work

---

## Device-Specific Tests

### Desktop
- [ ] All elements fit within viewport
- [ ] Hover states work correctly
- [ ] Tooltips are positioned correctly

### Mobile
- [ ] Touch targets are at least 44x44px
- [ ] Swipe gestures work
- [ ] No horizontal scroll
- [ ] Bottom navigation is accessible

### Tablet
- [ ] Layout adapts correctly
- [ ] Touch targets are accessible

---

## Regression Prevention

### CSS Architecture
- [ ] All colors use CSS custom properties
- [ ] No hardcoded hex colors in components
- [ ] Tailwind dark: classes used consistently
- [ ] Theme variables are documented

### Code Review Checklist
- [ ] New components include dark mode classes
- [ ] CSS changes include dark mode variants
- [ ] Color changes are tested in both themes

---

## Test Execution Log

| Date | Tester | Browser | Theme | Issues Found | Status |
|------|--------|---------|-------|--------------|--------|
|      |        |         |       |              |        |
|      |        |         |       |              |        |
|      |        |         |       |              |        |

---

## Issue Reporting

If issues are found, document:
1. Page/component name
2. Expected behavior
3. Actual behavior
4. Screenshot (if possible)
5. Browser and OS
6. Theme mode (light/dark/system)

---

## Sign-Off

- [ ] All tests pass
- [ ] No critical issues remain
- [ ] Accessibility requirements met
- [ ] Performance acceptable

**Tested by:** _________________  
**Date:** _________________  
**Approved by:** _________________
