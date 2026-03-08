import { renderHook, act } from "@testing-library/react";
import {
  useDebounce,
  useThrottle,
  useIntersectionObserver,
} from "../usePerformance";

/**
 * Performance Hooks Unit Tests
 * Tests for debouncing, throttling, and lazy loading
 */

describe("usePerformance Hooks", () => {
  describe("useDebounce", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return initial value immediately", () => {
      const { result } = renderHook(() => useDebounce("initial", 500));

      expect(result.current).toBe("initial");
    });

    it("should debounce value changes", () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        { initialProps: { value: "initial" } },
      );

      rerender({ value: "changed" });

      // Should still have initial value
      expect(result.current).toBe("initial");

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Now should have new value
      expect(result.current).toBe("changed");
    });

    it("should reset timer on rapid changes", () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 500),
        { initialProps: { value: "initial" } },
      );

      rerender({ value: "change1" });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      rerender({ value: "change2" });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Should still be initial because timer reset
      expect(result.current).toBe("initial");

      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Now should be change2
      expect(result.current).toBe("change2");
    });

    it("should use custom delay", () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 1000),
        { initialProps: { value: "initial" } },
      );

      rerender({ value: "changed" });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current).toBe("initial");

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current).toBe("changed");
    });
  });

  describe("useThrottle", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should call callback immediately on first call", () => {
      const callback = jest.fn();
      const { result } = renderHook(() => useThrottle(callback, 1000));

      act(() => {
        result.current();
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should throttle subsequent calls", () => {
      const callback = jest.fn();
      const { result } = renderHook(() => useThrottle(callback, 1000));

      // First call
      act(() => {
        result.current("arg1");
      });

      // Immediate second call (should be throttled)
      act(() => {
        result.current("arg2");
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith("arg1");

      // Advance time
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Now third call should work
      act(() => {
        result.current("arg3");
      });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith("arg3");
    });

    it("should pass arguments to callback", () => {
      const callback = jest.fn();
      const { result } = renderHook(() => useThrottle(callback, 1000));

      act(() => {
        result.current("arg1", "arg2", { key: "value" });
      });

      expect(callback).toHaveBeenCalledWith("arg1", "arg2", { key: "value" });
    });
  });

  describe("useIntersectionObserver", () => {
    let observerCallback = null;
    let observeMock = jest.fn();
    let disconnectMock = jest.fn();

    beforeEach(() => {
      global.IntersectionObserver = jest.fn((callback) => {
        observerCallback = callback;
        return {
          observe: observeMock,
          disconnect: disconnectMock,
        };
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should create observer with ref", () => {
      const { result } = renderHook(() => useIntersectionObserver());
      const [ref] = result.current;

      // Create element and assign ref
      const div = document.createElement("div");
      ref.current = div;

      // Trigger useEffect
      renderHook(() => useIntersectionObserver());

      expect(IntersectionObserver).toHaveBeenCalled();
    });

    it("should set isIntersecting to true when element intersects", () => {
      // Create a fresh mock for this test
      let testObserverCallback = null;
      global.IntersectionObserver = jest.fn((callback) => {
        testObserverCallback = callback;
        return {
          observe: observeMock,
          disconnect: disconnectMock,
        };
      });

      const { result } = renderHook(() => useIntersectionObserver());
      const [ref] = result.current;

      const div = document.createElement("div");
      ref.current = div;

      // Simulate intersection using the captured callback
      act(() => {
        if (testObserverCallback) {
          testObserverCallback([{ isIntersecting: true }]);
        }
      });

      const [, newIsIntersecting] = result.current;
      expect(newIsIntersecting).toBe(true);
    });

    it("should disconnect observer after intersection", () => {
      const { result } = renderHook(() => useIntersectionObserver());
      const [ref] = result.current;

      const div = document.createElement("div");
      ref.current = div;

      act(() => {
        if (observerCallback) {
          observerCallback([{ isIntersecting: true }]);
        }
      });

      expect(disconnectMock).toHaveBeenCalled();
    });

    it("should use custom options", () => {
      const options = { threshold: 0.5, rootMargin: "100px" };

      renderHook(() => useIntersectionObserver(options));

      expect(IntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          threshold: 0.5,
          rootMargin: "100px",
        }),
      );
    });
  });
});
