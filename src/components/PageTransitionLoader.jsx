/**
 * PageTransitionLoader Component
 * Displays a loading overlay during page transitions
 *
 * Features:
 * - Full-screen overlay with backdrop blur
 * - Animated spinner
 * - Accessible (aria-live region)
 * - Dark mode support
 *
 * @version 1.0
 * @since 2026-03-01
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * PageTransitionLoader - Shows loading state during navigation
 * @param {Object} props - Component props
 * @param {string} [props.message='Loading...'] - Loading message to display
 * @param {boolean} [props.fullScreen=true] - Whether to cover full screen
 * @returns {JSX.Element} Loading overlay component
 */
const PageTransitionLoader = ({ message = 'Loading...', fullScreen = true }) => {
  return (
    <div
      className={`
        fixed inset-0
        bg-white/80 dark:bg-gray-900/80
        backdrop-blur-sm
        flex items-center justify-center
        z-[600]
        transition-opacity duration-300
        ${fullScreen ? 'min-h-screen' : ''}
      `}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 p-6">
        <Loader2
          className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-spin"
          aria-hidden="true"
        />
        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">
          {message}
        </p>
      </div>
      {/* Visually hidden text for screen readers */}
      <span className="sr-only">
        {message} Please wait.
      </span>
    </div>
  );
};

export default PageTransitionLoader;
