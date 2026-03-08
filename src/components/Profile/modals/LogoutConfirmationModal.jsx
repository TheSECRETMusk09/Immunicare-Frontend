import React, { useEffect, useRef } from "react";
import { LogOut, X } from "lucide-react";

/**
 * LogoutConfirmationModal Component
 * Styled like admin dashboard forms with consistent theming
 * 
 * Features:
 * - Admin-style card design with rounded-3xl corners
 * - Dark mode and light mode support
 * - Responsive layout (mobile-first)
 * - Backdrop blur effect
 * - Focus trap for accessibility
 * - Keyboard navigation (Escape to close)
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Function} props.onConfirm - Callback when logout is confirmed
 */
const LogoutConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
  const modalRef = useRef(null);
  const confirmButtonRef = useRef(null);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      // Focus the confirm button when modal opens
      setTimeout(() => confirmButtonRef.current?.focus(), 100);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Handle click outside to close
  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  };

  // Handle confirm logout
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[310] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      aria-describedby="logout-modal-description"
    >
      {/* Modal Card - Styled like AdminLoginPage */}
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 shadow-2xl overflow-hidden transform transition-all duration-200 animate-in fade-in zoom-in-95">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Content */}
        <div className="p-6 sm:p-8 flex flex-col items-center text-center">
          
          {/* Icon Header - Admin Style */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-lg mb-6">
            <LogOut className="w-7 h-7" />
          </div>

          {/* Title */}
          <h2
            id="logout-modal-title"
            className="text-2xl font-bold text-slate-900 dark:text-white mb-2"
          >
            Sign Out
          </h2>

          {/* Description */}
          <p
            id="logout-modal-description"
            className="text-slate-600 dark:text-gray-300 mb-8 leading-relaxed"
          >
            Are you sure you want to sign out of your account? You will need to sign in again to access your dashboard.
          </p>

          {/* Action Buttons - Admin Form Style */}
          <div className="w-full flex flex-col-reverse sm:flex-row gap-3 sm:justify-center">
            {/* Cancel Button */}
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-700 dark:text-gray-200 font-semibold hover:bg-slate-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 min-h-[48px]"
              type="button"
            >
              Cancel
            </button>

            {/* Confirm Logout Button */}
            <button
              ref={confirmButtonRef}
              onClick={handleConfirm}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 shadow-lg shadow-red-500/30 transition-all duration-200 min-h-[48px] flex items-center justify-center gap-2"
              type="button"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Bottom Border Accent */}
        <div className="h-1 w-full bg-gradient-to-r from-red-500 via-red-600 to-red-700" />
      </div>
    </div>
  );
};

export default LogoutConfirmationModal;
