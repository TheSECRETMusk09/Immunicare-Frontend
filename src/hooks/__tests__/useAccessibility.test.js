import { renderHook, act, screen } from "@testing-library/react";
import {
  useAnnounce,
  useReducedMotion,
  useKeyboardNavigation,
  useClickOutside,
  usePageTitle,
  useAriaExpanded,
} from "../useAccessibility";

/**
 * Accessibility Hooks Unit Tests
 * Tests for WCAG 2.1 compliance and accessibility features
 */

describe("useAccessibility Hooks", () => {
  describe("useAnnounce", () => {
    it("should create announcement element", () => {
      const { result } = renderHook(() => useAnnounce());

      act(() => {
        result.current("Test announcement");
      });

      const announcement = screen.getByRole("status");
      expect(announcement).toBeInTheDocument();
      expect(announcement).toHaveTextContent("Test announcement");
    });

    it("should use polite priority by default", () => {
      const { result } = renderHook(() => useAnnounce());

      act(() => {
        result.current("Test announcement");
      });

      // Check for aria-live="polite" attribute instead of label
      const announcement = screen.getByRole("status");
      expect(announcement).toHaveAttribute("aria-live", "polite");
      expect(announcement).toBeInTheDocument();
    });

    it("should support assertive priority", () => {
      const { result } = renderHook(() => useAnnounce());

      act(() => {
        result.current("Urgent announcement", "assertive");
      });

      // Check for aria-live="assertive" attribute
      const announcements = screen.getAllByRole("status");
      const assertiveAnnouncement = announcements.find(
        (el) => el.getAttribute("aria-live") === "assertive",
      );
      expect(assertiveAnnouncement).toBeInTheDocument();
      expect(assertiveAnnouncement).toHaveTextContent("Urgent announcement");
    });

    it("should clean up announcement after timeout", () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useAnnounce());

      act(() => {
        result.current("Test announcement");
      });

      // Get all status elements and find the one with our text
      const announcements = screen.getAllByRole("status");
      const targetAnnouncement = announcements.find(
        (el) => el.textContent === "Test announcement",
      );
      expect(targetAnnouncement).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(1100);
      });

      // After cleanup, the announcement should be removed
      expect(screen.queryByText("Test announcement")).not.toBeInTheDocument();
      jest.useRealTimers();
    });
  });

  describe("useReducedMotion", () => {
    it("should detect reduced motion preference", () => {
      // Mock matchMedia
      window.matchMedia = jest.fn().mockImplementation((query) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));

      const { result } = renderHook(() => useReducedMotion());

      expect(result.current).toBe(true);
    });

    it("should return false when no reduced motion preference", () => {
      window.matchMedia = jest.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));

      const { result } = renderHook(() => useReducedMotion());

      expect(result.current).toBe(false);
    });

    it("should update when preference changes", () => {
      let changeCallback = null;
      window.matchMedia = jest.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: jest.fn((event, callback) => {
          if (event === "change") changeCallback = callback;
        }),
        removeEventListener: jest.fn(),
      }));

      const { result } = renderHook(() => useReducedMotion());

      act(() => {
        changeCallback({ matches: true });
      });

      expect(result.current).toBe(true);
    });
  });

  describe("useKeyboardNavigation", () => {
    it("should initialize with -1 index", () => {
      const { result } = renderHook(() => useKeyboardNavigation(5));

      expect(result.current.focusedIndex).toBe(-1);
    });

    it("should navigate down with ArrowDown", () => {
      const { result } = renderHook(() => useKeyboardNavigation(5));

      act(() => {
        result.current.handleKeyDown({
          key: "ArrowDown",
          preventDefault: jest.fn(),
        });
      });

      expect(result.current.focusedIndex).toBe(0);

      act(() => {
        result.current.handleKeyDown({
          key: "ArrowDown",
          preventDefault: jest.fn(),
        });
      });

      expect(result.current.focusedIndex).toBe(1);
    });

    it("should navigate up with ArrowUp", () => {
      const { result } = renderHook(() => useKeyboardNavigation(5));

      act(() => {
        result.current.setFocusedIndex(2);
      });

      act(() => {
        result.current.handleKeyDown({
          key: "ArrowUp",
          preventDefault: jest.fn(),
        });
      });

      expect(result.current.focusedIndex).toBe(1);
    });

    it("should wrap around at boundaries", () => {
      const { result } = renderHook(() => useKeyboardNavigation(3));

      // Navigate to last item
      act(() => {
        result.current.setFocusedIndex(2);
      });

      // Press down - should wrap to first
      act(() => {
        result.current.handleKeyDown({
          key: "ArrowDown",
          preventDefault: jest.fn(),
        });
      });

      expect(result.current.focusedIndex).toBe(0);

      // Press up - should wrap to last
      act(() => {
        result.current.handleKeyDown({
          key: "ArrowUp",
          preventDefault: jest.fn(),
        });
      });

      expect(result.current.focusedIndex).toBe(2);
    });

    it("should handle Home key", () => {
      const { result } = renderHook(() => useKeyboardNavigation(5));

      act(() => {
        result.current.setFocusedIndex(3);
      });

      act(() => {
        result.current.handleKeyDown({
          key: "Home",
          preventDefault: jest.fn(),
        });
      });

      expect(result.current.focusedIndex).toBe(0);
    });

    it("should handle End key", () => {
      const { result } = renderHook(() => useKeyboardNavigation(5));

      act(() => {
        result.current.handleKeyDown({ key: "End", preventDefault: jest.fn() });
      });

      expect(result.current.focusedIndex).toBe(4);
    });
  });

  describe("useClickOutside", () => {
    it("should call callback when clicking outside", () => {
      const callback = jest.fn();
      const { result } = renderHook(() => useClickOutside(callback, true));

      // Create a div and attach ref
      const div = document.createElement("div");
      result.current.current = div;
      document.body.appendChild(div);

      // Click outside
      act(() => {
        document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });

      expect(callback).toHaveBeenCalled();

      document.body.removeChild(div);
    });

    it("should not call callback when clicking inside", () => {
      const callback = jest.fn();
      const { result } = renderHook(() => useClickOutside(callback, true));

      const div = document.createElement("div");
      result.current.current = div;
      document.body.appendChild(div);

      // Click inside
      act(() => {
        div.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });

      expect(callback).not.toHaveBeenCalled();

      document.body.removeChild(div);
    });

    it("should call callback on Escape key", () => {
      const callback = jest.fn();
      renderHook(() => useClickOutside(callback, true));

      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("usePageTitle", () => {
    it("should update document title", () => {
      const originalTitle = document.title;

      renderHook(() => usePageTitle("Test Page"));

      expect(document.title).toBe("Test Page | Immunicare");

      // Cleanup should restore original title
      document.title = originalTitle;
    });

    it("should use default title when no title provided", () => {
      const originalTitle = document.title;

      renderHook(() => usePageTitle(""));

      expect(document.title).toBe("Immunicare");

      document.title = originalTitle;
    });
  });

  describe("useAriaExpanded", () => {
    it("should initialize with default state", () => {
      const { result } = renderHook(() => useAriaExpanded(false));

      expect(result.current.isExpanded).toBe(false);
      expect(result.current.ariaProps["aria-expanded"]).toBe(false);
    });

    it("should toggle state", () => {
      const { result } = renderHook(() => useAriaExpanded(false));

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isExpanded).toBe(true);

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isExpanded).toBe(false);
    });

    it("should expand", () => {
      const { result } = renderHook(() => useAriaExpanded(false));

      act(() => {
        result.current.expand();
      });

      expect(result.current.isExpanded).toBe(true);
    });

    it("should collapse", () => {
      const { result } = renderHook(() => useAriaExpanded(true));

      act(() => {
        result.current.collapse();
      });

      expect(result.current.isExpanded).toBe(false);
    });
  });
});
