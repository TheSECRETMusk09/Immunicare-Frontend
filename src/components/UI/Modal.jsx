import React, { useEffect, useCallback } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import Button from "./Button";
import FormActions from "./FormActions";

/**
 * Compact Modal component with reduced spacing for Guardian Dashboard
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {Function} props.onClose - Function to call when closing the modal
 * @param {string} props.title - Modal title
 * @param {ReactNode} props.children - Modal content
 * @param {ReactNode} props.footer - Modal footer content
 * @param {string} props.size - Modal size: 'sm', 'md', 'lg', 'xl', 'full'
 * @param {string} props.type - Modal type: 'default', 'success', 'error', 'warning', 'info'
 * @param {boolean} props.showClose - Show close button
 * @param {boolean} props.closeOnOverlay - Close when clicking outside
 * @param {boolean} props.closeOnEscape - Close when pressing Escape
 * @param {Function} props.onConfirm - Optional confirm action
 * @param {string} props.confirmText - Confirm button text
 * @param {string} props.cancelText - Cancel button text
 * @param {boolean} props.isLoading - Show loading state on confirm
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  type = "default",
  showClose = true,
  closeOnOverlay = true,
  closeOnEscape = true,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isLoading = false,
}) => {
  // Handle escape key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape" && closeOnEscape) {
        onClose();
      }
    },
    [closeOnEscape, onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Type-specific styles with improved color contrast for accessibility
  const typeStyles = {
    default: {
      header: "bg-[var(--color-bg-primary)]",
      icon: null,
      confirmVariant: "primary",
    },
    success: {
      header: "bg-[var(--theme-success-bg)]",
      icon: <CheckCircle className="w-5 h-5 text-[var(--theme-success)]" />,
      confirmVariant: "success",
    },
    error: {
      header: "bg-[var(--theme-error-bg)]",
      icon: <AlertCircle className="w-5 h-5 text-[var(--theme-error)]" />,
      confirmVariant: "danger",
    },
    warning: {
      header: "bg-[var(--theme-warning-bg)]",
      icon: <AlertTriangle className="w-5 h-5 text-[var(--theme-warning)]" />,
      confirmVariant: "warning",
    },
    info: {
      header: "bg-[var(--theme-info-bg)]",
      icon: <Info className="w-5 h-5 text-[var(--theme-info)]" />,
      confirmVariant: "info",
    },
  };

  const currentType = typeStyles[type];
  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
    full: "max-w-[95vw]",
  };
  const resolvedSizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <div className="fixed inset-0 z-[1000]">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />

      <div className="relative flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className={`
            admin-modal-layout relative flex w-full max-h-[90vh] flex-col overflow-hidden rounded-xl
            border border-[var(--color-border-light)] bg-[var(--color-bg-primary)]
            shadow-2xl ring-1 ring-black/5 dark:ring-white/10
            ${resolvedSizeClass}
          `}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {(title || showClose) && (
            <div
              className={`
                admin-modal-header flex items-center justify-between gap-3 border-b
                border-[var(--color-border-light)] px-6 py-5
                ${currentType.header}
                flex-shrink-0
              `}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                  {currentType.icon && (
                  <div className="hidden flex-shrink-0 sm:block">{currentType.icon}</div>
                  )}
                  {title && (
                    <h3
                      id="modal-title"
                    className="modal-title truncate text-base font-bold text-[var(--color-text-primary)] sm:text-lg"
                    >
                      {title}
                    </h3>
                  )}
              </div>

              {showClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex min-h-[40px] min-w-[40px] flex-shrink-0 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          )}

          <div className="admin-modal-body flex-1 min-h-0 overflow-y-auto px-6 py-6">
            {children}
          </div>

          {(footer || onConfirm) && (
            <div
              className="
                admin-modal-footer mt-auto px-6 py-5 bg-[var(--color-bg-primary)]
                border-t border-[var(--color-border-default)]
                flex-shrink-0
              "
            >
              {footer ? (
                footer
              ) : (
                <FormActions className="admin-modal-actions">
                  {cancelText && (
                    <Button
                      type="button"
                      variant="cancel"
                      actionRole="cancel"
                      onClick={onClose}
                      className="ui-form-action-btn ui-form-action-btn--secondary"
                    >
                      {cancelText}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant={currentType.confirmVariant}
                    actionRole="primary"
                    onClick={onConfirm}
                    loading={isLoading}
                    disabled={isLoading}
                    className="ui-form-action-btn ui-form-action-btn--primary"
                  >
                    {confirmText}
                  </Button>
                </FormActions>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Confirmation Modal Component
export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Yes, Continue",
  cancelText = "Cancel",
  type = "warning",
  isLoading = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      type={type}
      size="sm"
      onConfirm={onConfirm}
      confirmText={confirmText}
      cancelText={cancelText}
      isLoading={isLoading}
    >
      <p className="text-[var(--color-text-secondary)]">{message}</p>
    </Modal>
  );
};

// Info Modal Component
export const InfoModal = ({
  isOpen,
  onClose,
  title = "Information",
  message,
  buttonText = "OK",
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      type="info"
      size="sm"
      onConfirm={onClose}
      confirmText={buttonText}
      cancelText=""
    >
      <p className="text-[var(--color-text-secondary)]">{message}</p>
    </Modal>
  );
};

export default Modal;
