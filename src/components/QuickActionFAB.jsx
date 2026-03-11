/**
 * QuickActionFAB Component
 *
 * A floating action button component for quick access to common guardian actions.
 * Designed for one-handed usage scenarios common in caregiving contexts.
 *
 * Features:
 * - Expandable menu with common actions
 * - Touch-friendly sizing (48px minimum)
 * - Positioned in bottom-right thumb zone
 * - Smooth animations with reduced motion support
 * - Accessible keyboard navigation
 * - Dark mode support
 *
 * @version 1.0
 * @since 2026-03-02
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, Users, Phone, X } from 'lucide-react';

export const GUARDIAN_OPEN_ADD_CHILD_MODAL_EVENT = 'guardian:open-add-child-modal';
export const GUARDIAN_INFANT_REGISTERED_EVENT = 'guardian:infant-registered';

export const triggerGuardianAddChildModal = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const addChildModalEvent = new CustomEvent(
    GUARDIAN_OPEN_ADD_CHILD_MODAL_EVENT,
    {
      cancelable: true,
      detail: {
        source: 'quick-action-fab',
        timestamp: Date.now(),
      },
    },
  );

  const eventNotCancelled = window.dispatchEvent(addChildModalEvent);
  return !eventNotCancelled;
};

export const triggerGuardianInfantRegistered = (infant = null) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(GUARDIAN_INFANT_REGISTERED_EVENT, {
      detail: {
        infant,
        timestamp: Date.now(),
      },
    }),
  );
};

const QuickActionFAB = ({
  isGuardian = true,
  emergencyContact = null,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Handle scroll behavior - hide FAB when scrolling down, show when scrolling up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show FAB when scrolling up or near top
      if (currentScrollY < lastScrollY || currentScrollY < 100) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Hide when scrolling down (but not when menu is open)
        if (!isOpen) {
          setIsVisible(false);
        }
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isOpen]);

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key to close menu
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Trap focus within menu when open
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const focusableElements = menuRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstElement.focus();

    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  const toggleMenu = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleAction = useCallback((action) => {
    setIsOpen(false);

    switch (action) {
      case 'addChild':
        if (!triggerGuardianAddChildModal()) {
          navigate('/guardian/children');
          setTimeout(() => {
            triggerGuardianAddChildModal();
          }, 0);
        }
        break;
      case 'bookAppointment':
        navigate('/guardian/appointments/new');
        break;
      case 'emergency':
        if (emergencyContact) {
          window.location.href = `tel:${emergencyContact}`;
        } else {
          // Default emergency number or show emergency modal
          window.location.href = 'tel:911';
        }
        break;
      default:
        break;
    }
  }, [navigate, emergencyContact]);

  // Don't render if user is not a guardian
  if (!isGuardian) return null;

  const actions = [
    {
      id: 'addChild',
      label: 'Add Child',
      icon: Users,
      color: 'bg-blue-500 hover:bg-blue-600',
      darkColor: 'dark:bg-blue-600 dark:hover:bg-blue-500',
      description: 'Register a new child'
    },
    {
      id: 'bookAppointment',
      label: 'Book Appointment',
      icon: Calendar,
      color: 'bg-emerald-500 hover:bg-emerald-600',
      darkColor: 'dark:bg-emerald-600 dark:hover:bg-emerald-500',
      description: 'Schedule vaccination'
    },
    {
      id: 'emergency',
      label: 'Emergency',
      icon: Phone,
      color: 'bg-red-500 hover:bg-red-600',
      darkColor: 'dark:bg-red-600 dark:hover:bg-red-500',
      description: 'Call emergency number',
      isEmergency: true
    }
  ];

  return (
    <div
      ref={menuRef}
      className={`fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3 ${className}`}
      style={{
        transform: isVisible ? 'translateY(0)' : 'translateY(100px)',
        opacity: isVisible ? 1 : 0,
        transition: 'transform 0.3s ease, opacity 0.3s ease'
      }}
    >
      {/* Action Menu Items */}
      <div
        className={`flex flex-col items-end gap-2 transition-all duration-300 ${
          isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        role="menu"
        aria-label="Quick actions"
      >
        {actions.map((action, index) => (
          <div
            key={action.id}
            className={`flex items-center gap-3 transition-all duration-300 ${
              isOpen ? 'translate-x-0' : 'translate-x-4'
            }`}
            style={{
              transitionDelay: isOpen ? `${index * 50}ms` : '0ms'
            }}
          >
            {/* Label */}
            <span
              className={`px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg whitespace-nowrap ${
                action.isEmergency
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/80 dark:text-red-200'
                  : 'bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-200'
              }`}
              id={`fab-label-${action.id}`}
            >
              {action.label}
            </span>

            {/* Action Button */}
            <button
              onClick={() => handleAction(action.id)}
              className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-200 ${action.color} ${action.darkColor} hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900`}
              style={{
                minWidth: '48px',
                minHeight: '48px',
                touchAction: 'manipulation'
              }}
              role="menuitem"
              aria-labelledby={`fab-label-${action.id}`}
              aria-describedby={`fab-desc-${action.id}`}
              tabIndex={isOpen ? 0 : -1}
            >
              <action.icon className="w-5 h-5" aria-hidden="true" />
            </button>

            {/* Screen reader description */}
            <span id={`fab-desc-${action.id}`} className="sr-only">
              {action.description}
            </span>
          </div>
        ))}
      </div>

      {/* Main FAB Button */}
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-300 ${
          isOpen
            ? 'bg-gray-600 hover:bg-gray-700 rotate-45 dark:bg-gray-700 dark:hover:bg-gray-600'
            : 'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 hover:scale-105'
        } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900`}
        style={{
          minWidth: '56px',
          minHeight: '56px',
          touchAction: 'manipulation',
          boxShadow: isOpen
            ? '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
            : '0 10px 25px -5px rgba(59, 130, 246, 0.4), 0 8px 10px -6px rgba(59, 130, 246, 0.2)'
        }}
        aria-label={isOpen ? 'Close quick actions menu' : 'Open quick actions menu'}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls="quick-actions-menu"
      >
        {isOpen ? (
          <X className="w-6 h-6 transition-transform duration-300" aria-hidden="true" />
        ) : (
          <Plus className="w-6 h-6 transition-transform duration-300" aria-hidden="true" />
        )}
      </button>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-[-1] md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default QuickActionFAB;
