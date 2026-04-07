// UI Components Index
// Re-export all UI components for easy importing

// Core components
export { default as Button } from "./Button";
export { default as Input } from "./Input";
export { default as Card } from "./Card";
export { default as Modal } from "./Modal";
export { default as LoadingSpinner } from "./LoadingSpinner";
export { default as Badge } from "./Badge";
export { default as Alert } from "./Alert";
export { default as Select } from "./Select";
export { default as PageHeader } from "./PageHeader";
export { default as PageContainer } from "./PageContainer";
export { default as DataTable } from "./DataTable";
export { default as EmptyState } from "./EmptyState";
export { default as AdminModalActions } from "./AdminModalActions";

// Loading button with hook
export { default as LoadingButton, useLoadingButton } from "./LoadingButton";

// Skeleton loaders
export {
  SkeletonCard,
  SkeletonGrid,
  SkeletonTable,
  SkeletonText,
  SkeletonChart,
  SkeletonAvatar,
  SkeletonFormField,
  SkeletonForm,
  SkeletonPageHeader,
  SkeletonList,
  SkeletonCalendar,
  LoadingOverlay,
  SkeletonDashboardOverview,
} from "./SkeletonLoader";

// Form components
export { default as TextInput } from "./TextInput";
export { default as PasswordInput } from "./PasswordInput";
export { default as PasswordToggleButton } from "./PasswordToggleButton";
export { default as PasswordVisibilityToggle } from "./PasswordVisibilityToggle";
export { default as Checkbox } from "./Checkbox";
export { default as RememberMeCheckbox } from "./RememberMeCheckbox";
export { default as TextArea } from "./TextArea";
export {
   default as FormError,
   FormErrorSummary,
   FieldError,
} from "./FormError";

// Navigation components
export { Tabs, Tab } from "./Tabs";

// Header components
export { default as AdminHeader } from "./AdminHeader";
export { default as GuardianHeader } from "./GuardianHeader";

// Error handling
export {
  default as ErrorBoundary,
  withErrorBoundary,
  ErrorDisplay,
} from "./ErrorBoundary";

// Toast notifications (legacy - use NotificationContext instead)
export { default as ToastItem, useToast, ToastProvider } from "./Toast";

// Date picker (portal-based, immune to overflow:hidden clipping)
export { default as PortalDatePicker } from "./PortalDatePicker";

// Accessibility components
export { default as LoadingFallback } from "./LoadingFallback";
export { default as SkipLink } from "./SkipLink";
export { default as VisuallyHidden } from "./VisuallyHidden";
