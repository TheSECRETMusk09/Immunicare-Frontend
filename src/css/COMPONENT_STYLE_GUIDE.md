# Component Style Guide

## Immunicare Vaccination Management System

This document provides comprehensive guidelines for using and styling UI components in the Immunicare application.

---

## Table of Contents

1. [Button](#button)
2. [Card](#card)
3. [Input](#input)
4. [Select](#select)
5. [Modal](#modal)
6. [Table](#table)
7. [Tabs](#tabs)
8. [Accordion](#accordion)
9. [Toast](#toast)
10. [Badge](#badge)
11. [Alert](#alert)
12. [Progress](#progress)
13. [Dropdown](#dropdown)
14. [Tooltip](#tooltip)
15. [Pagination](#pagination)
16. [Breadcrumb](#breadcrumb)
17. [File Upload](#file-upload)
18. [Skeleton Loader](#skeleton-loader)
19. [Empty State](#empty-state)
20. [Search](#search)

---

## Button

### Usage

```jsx
import { Button } from './components/UI';

// Primary button
<Button variant="primary">Primary</Button>

// Secondary button
<Button variant="secondary">Secondary</Button>

// Outline button
<Button variant="outline">Outline</Button>

// Danger button
<Button variant="danger">Delete</Button>

// Success button
<Button variant="success">Save</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

// With icon
<Button icon={<PlusIcon />}>Add Item</Button>

// Loading state
<Button loading>Loading...</Button>

// Disabled
<Button disabled>Disabled</Button>
```

### CSS Classes

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  min-height: 44px;
}

.btn-primary {
  background-color: var(--color-primary-600);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-700);
}

.btn-sm {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-xs);
  min-height: 36px;
}

.btn-lg {
  padding: var(--space-4) var(--space-6);
  font-size: var(--font-size-base);
}

.btn-block {
  width: 100%;
}
```

### Tailwind Classes

```jsx
<button
  className="
  inline-flex items-center justify-center gap-2
  px-5 py-3
  text-sm font-medium
  rounded-lg
  bg-primary-600 text-white
  hover:bg-primary-700
  transition-colors
  min-h-[44px]
"
>
  Button Text
</button>
```

---

## Card

### Usage

```jsx
import { Card } from './components/UI';

<Card>
  <Card.Header>
    <Card.Title>Card Title</Card.Title>
    <Card.Subtitle>Card subtitle</Card.Subtitle>
  </Card.Header>
  <Card.Body>
    Card content goes here
  </Card.Body>
  <Card.Footer>
    <Button>Action</Button>
  </Card.Footer>
</Card>

// Variants
<Card variant="elevated">Elevated Card</Card>
<Card variant="outlined">Outlined Card</Card>
<Card variant="flat">Flat Card</Card>
```

### CSS Classes

```css
.card {
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  padding: var(--space-6);
  color: var(--color-text-primary);
  transition: box-shadow var(--transition-fast);
}

.card:hover {
  box-shadow: var(--shadow-md);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.card-body {
  color: var(--color-text-secondary);
}

.card-footer {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-light);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
}
```

---

## Input

### Usage

```jsx
import { Input, TextInput, PasswordInput } from './components/UI';

<Input
  label="Email Address"
  placeholder="Enter your email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>

// With error
<Input
  label="Username"
  value={username}
  onChange={handleChange}
  error={errors.username}
  required
/>

// With hint
<Input
  label="Password"
  type="password"
  value={password}
  onChange={handleChange}
  hint="Must be at least 8 characters"
/>

// With addon
<Input
  label="Website"
  value={website}
  onChange={handleChange}
  addon="https://"
/>
```

### CSS Classes

```css
.input-group {
  margin-bottom: var(--space-4);
}

.input-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.input-label.required::after {
  content: " *";
  color: var(--color-danger-500);
}

.input-field {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-base);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.input-field:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.input-field.has-error {
  border-color: var(--color-danger-500);
}

.input-field.has-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.input-error {
  font-size: var(--font-size-sm);
  color: var(--color-danger-600);
  margin-top: var(--space-1);
}

.input-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}
```

---

## Select

### Usage

```jsx
import { Select } from './components/UI';

<Select
  label="Select Option"
  value={selected}
  onChange={handleSelect}
  options={[
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
    { value: '3', label: 'Option 3' },
  ]}
/>

// With error
<Select
  label="Category"
  value={category}
  onChange={handleChange}
  options={options}
  error={errors.category}
/>
```

### CSS Classes

```css
.select-field {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-base);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 12px center;
  background-repeat: no-repeat;
  background-size: 20px;
  padding-right: 40px;
}

.select-field:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
```

---

## Modal

### Usage

```jsx
import { Modal } from './components/UI';

<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Modal Title"
  size="md"
>
  <Modal.Body>
    Modal content goes here
  </Modal.Body>
  <Modal.Footer>
    <Button variant="outline" onClick={handleClose}>Cancel</Button>
    <Button onClick={handleConfirm}>Confirm</Button>
  </Modal.Footer>
</Modal>

// Sizes
<Modal size="sm">Small Modal</Modal>
<Modal size="md">Medium Modal</Modal>
<Modal size="lg">Large Modal</Modal>
<Modal size="xl">Extra Large Modal</Modal>
<Modal size="full">Full Screen Modal</Modal>
```

### CSS Classes

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: var(--z-modal-backdrop);
  animation: fadeIn var(--transition-fast);
}

.modal {
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp var(--transition-normal);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--color-border-light);
}

.modal-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  transition: background-color var(--transition-fast);
}

.modal-close:hover {
  background-color: var(--color-bg-tertiary);
}

.modal-body {
  padding: var(--space-6);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  border-top: 1px solid var(--color-border-light);
}
```

---

## Table

### Usage

```jsx
import { DataTable } from "./components/UI";

<DataTable
  columns={columns}
  data={data}
  sortable
  selectable
  pagination
  onRowClick={handleRowClick}
/>;
```

### CSS Classes

```css
.table-container {
  overflow-x: auto;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.table th {
  text-align: left;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  padding: var(--space-4);
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-light);
  white-space: nowrap;
}

.table td {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border-light);
  color: var(--color-text-primary);
}

.table tbody tr:last-child td {
  border-bottom: none;
}

.table tbody tr:hover {
  background-color: var(--color-bg-tertiary);
}

.table tbody tr.selected {
  background-color: var(--color-primary-50);
}
```

---

## Tabs

### Usage

```jsx
import { Tabs } from "./components/UI";

<Tabs>
  <Tabs.List>
    <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
    <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
    <Tabs.Trigger value="tab3">Tab 3</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="tab1">Content for tab 1</Tabs.Panel>
  <Tabs.Panel value="tab2">Content for tab 2</Tabs.Panel>
  <Tabs.Panel value="tab3">Content for tab 3</Tabs.Panel>
</Tabs>;
```

### CSS Classes

```css
.tabs-list {
  display: flex;
  border-bottom: 1px solid var(--color-border-light);
  gap: var(--space-1);
}

.tabs-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tabs-trigger:hover {
  color: var(--color-text-primary);
}

.tabs-trigger.active {
  color: var(--color-primary-600);
  border-bottom-color: var(--color-primary-600);
}

.tabs-content {
  padding: var(--space-4) 0;
}

.tabs-panel {
  display: none;
  animation: fadeIn var(--transition-fast);
}

.tabs-panel.active {
  display: block;
}
```

---

## Toast

### Usage

```jsx
import { ToastProvider, useToast } from "./components/UI";

function App() {
  return (
    <ToastProvider>
      <MyComponent />
    </ToastProvider>
  );
}

function MyComponent() {
  const { showToast } = useToast();

  const handleClick = () => {
    showToast({
      type: "success",
      title: "Success!",
      message: "Your changes have been saved.",
    });
  };

  return <Button onClick={handleClick}>Show Toast</Button>;
}
```

### CSS Classes

```css
.toast-container {
  position: fixed;
  top: var(--space-6);
  right: var(--space-6);
  z-index: var(--z-popover);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  min-width: 300px;
  max-width: 400px;
  animation: slideInRight var(--transition-normal);
}

.toast-success {
  border-left: 4px solid var(--color-secondary-500);
}

.toast-error {
  border-left: 4px solid var(--color-danger-500);
}

.toast-warning {
  border-left: 4px solid var(--color-warning-500);
}

.toast-info {
  border-left: 4px solid var(--color-info-500);
}
```

---

## Badge

### Usage

```jsx
import { Badge } from './components/UI';

<Badge variant="primary">Primary</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="danger">Danger</Badge>
<Badge variant="neutral">Neutral</Badge>

// With dot
<Badge variant="success" dot>Online</Badge>

// Pill badge
<Badge variant="primary" pill>New</Badge>
```

### CSS Classes

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-primary {
  background-color: var(--color-primary-100);
  color: var(--color-primary-700);
}

.badge-success {
  background-color: var(--color-secondary-100);
  color: var(--color-secondary-700);
}

.badge-warning {
  background-color: var(--color-warning-100);
  color: var(--color-warning-700);
}

.badge-danger {
  background-color: var(--color-danger-100);
  color: var(--color-danger-700);
}

.badge-neutral {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-700);
}
```

---

## Alert

### Usage

```jsx
import { Alert } from './components/UI';

<Alert variant="info" title="Information">
  This is an informational message.
</Alert>

<Alert variant="success" title="Success">
  Your operation completed successfully.
</Alert>

<Alert variant="warning" title="Warning">
  Please review the warnings.
</Alert>

<Alert variant="error" title="Error">
  An error occurred. Please try again.
</Alert>
```

### CSS Classes

```css
.alert {
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border-left: 4px solid;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.alert-info {
  background-color: var(--color-primary-50);
  border-color: var(--color-primary-500);
  color: var(--color-primary-800);
}

.alert-success {
  background-color: var(--color-secondary-50);
  border-color: var(--color-secondary-500);
  color: var(--color-secondary-800);
}

.alert-warning {
  background-color: var(--color-warning-50);
  border-color: var(--color-warning-500);
  color: var(--color-warning-800);
}

.alert-danger {
  background-color: var(--color-danger-50);
  border-color: var(--color-danger-500);
  color: var(--color-danger-800);
}

.alert-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}
```

---

## Progress

### Usage

```jsx
import { ProgressBar, CircularProgress } from './components/UI';

// Linear progress
<ProgressBar value={75} max={100} />

// With label
<ProgressBar value={50} max={100} label="50%" />

// Success variant
<ProgressBar value={100} max={100} variant="success" />

// Warning variant
<ProgressBar value={85} max={100} variant="warning" />

// Danger variant
<ProgressBar value={25} max={100} variant="danger" />

// Circular progress
<CircularProgress value={75} max={100} label="75%" />
```

### CSS Classes

```css
.progress-bar {
  width: 100%;
  height: 8px;
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background-color: var(--color-primary-500);
  border-radius: var(--radius-full);
  transition: width var(--transition-normal) ease-out;
}

.progress-bar-fill.success {
  background-color: var(--color-secondary-500);
}

.progress-bar-fill.warning {
  background-color: var(--color-warning-500);
}

.progress-bar-fill.danger {
  background-color: var(--color-danger-500);
}
```

---

## Dropdown

### Usage

```jsx
import { Dropdown } from "./components/UI";

<Dropdown trigger={<Button>Actions</Button>} placement="bottom-start">
  <Dropdown.Item onClick={handleEdit}>Edit</Dropdown.Item>
  <Dropdown.Item onClick={handleDuplicate}>Duplicate</Dropdown.Item>
  <Dropdown.Divider />
  <Dropdown.Item onClick={handleDelete} variant="danger">
    Delete
  </Dropdown.Item>
</Dropdown>;
```

### CSS Classes

```css
.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: var(--space-2);
  min-width: 200px;
  background-color: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: var(--z-dropdown);
  animation: slideDown var(--transition-fast);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  min-height: 44px;
}

.dropdown-item:hover {
  background-color: var(--color-bg-tertiary);
}

.dropdown-item:first-child {
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.dropdown-item:last-child {
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

.dropdown-divider {
  height: 1px;
  background-color: var(--color-border-light);
  margin: var(--space-2) 0;
}
```

---

## Tooltip

### Usage

```jsx
import { Tooltip } from "./components/UI";

<Tooltip content="This is a tooltip" placement="top">
  <Button>Hover me</Button>
</Tooltip>;
```

### CSS Classes

```css
.tooltip {
  position: relative;
  display: inline-block;
}

.tooltip-content {
  position: absolute;
  bottom: calc(100% + var(--space-2));
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: white;
  background-color: var(--color-neutral-900);
  border-radius: var(--radius-md);
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
  z-index: var(--z-tooltip);
}

.tooltip-content::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--color-neutral-900);
}

.tooltip:hover .tooltip-content,
.tooltip:focus-within .tooltip-content {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}
```

---

## File Upload

### Usage

```jsx
import { FileUpload, Dropzone } from './components/UI';

<FileUpload
  label="Upload Document"
  accept=".pdf,.doc,.docx"
  maxSize={5 * 1024 * 1024} // 5MB
  onChange={handleFiles}
  multiple
/>

<Dropzone
  accept="image/*"
  maxFiles={5}
  onDrop={handleDrop}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
>
  <DropzoneIcon />
  <DropzoneText>Drag and drop files here</DropzoneText>
  <DropzoneHint>or click to browse</DropzoneHint>
</Dropzone>
```

### CSS Classes

```css
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  border: 2px dashed var(--color-border-default);
  border-radius: var(--radius-xl);
  background-color: var(--color-bg-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.dropzone:hover {
  border-color: var(--color-primary-400);
  background-color: var(--color-primary-50);
}

.dropzone.drag-over {
  border-color: var(--color-primary-500);
  background-color: var(--color-primary-100);
}

.file-preview {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background-color: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
}
```

---

## Skeleton Loader

### Usage

```jsx
import { Skeleton, SkeletonText, SkeletonAvatar } from './components/UI';

<Card>
  <SkeletonAvatar size="lg" />
  <SkeletonText className="mt-4" />
  <SkeletonText width="60%" />
</Card>

// Table skeleton
<SkeletonTable rows={5} columns={4} />

// Card skeleton
<SkeletonCard />
```

### CSS Classes

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-bg-tertiary) 25%,
    var(--color-bg-secondary) 50%,
    var(--color-bg-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-md);
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton-text {
  height: 1em;
  width: 100%;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
}
```

---

## Accessibility Guidelines

### Focus Management

- All interactive elements must have visible focus indicators
- Use `:focus-visible` for appropriate focus styling
- Implement focus traps in modals

### ARIA Attributes

- Use `aria-label` for icon-only buttons
- Use `aria-describedby` for help text
- Use `aria-invalid` for form validation
- Use `aria-expanded` for accordions and dropdowns
- Use `aria-selected` for tabs

### Color Contrast

- Minimum 4.5:1 for normal text
- Minimum 3:1 for large text
- Minimum 3:1 for UI components

### Touch Targets

- Minimum 44x44px for touch targets
- Adequate spacing between interactive elements

---

## Responsive Design

### Mobile-First Approach

- Design for mobile first, then enhance for larger screens
- Use responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`

### Breakpoints

- `sm`: 640px and below
- `md`: 768px to 1024px
- `lg`: 1025px to 1280px
- `xl`: 1281px and above

---

## Dark Mode

### Using CSS Variables

```css
.card {
  background-color: var(--color-bg-primary);
}

[data-theme="dark"] .card {
  background-color: var(--color-bg-primary);
}
```

### Using Tailwind

```jsx
<div className="bg-white dark:bg-neutral-900">Content</div>
```

---

## Best Practices

1. **Consistency**: Use established patterns and components
2. **Accessibility**: Prioritize accessibility in all components
3. **Responsiveness**: Test at all breakpoints
4. **Performance**: Use efficient CSS and optimize for production
5. **Maintainability**: Follow naming conventions and documentation

---

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [MDN CSS Reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference)
