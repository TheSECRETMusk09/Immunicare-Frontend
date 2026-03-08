import { useEffect, useRef, useCallback, useState } from "react";

/**
 * usePerformanceMonitor Hook
 * Monitors and reports component performance metrics
 * Helps identify slow components and performance bottlenecks
 */
export const usePerformanceMonitor = (componentName) => {
  const renderCount = useRef(0);
  const renderStartTime = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
    const renderTime = performance.now() - renderStartTime.current;

    // Log slow renders (> 100ms)
    if (renderTime > 100) {
      console.warn(
        `[Performance] ${componentName} rendered slowly: ${renderTime.toFixed(2)}ms (render #${renderCount.current})`,
      );
    }

    // Report to analytics in production
    if (process.env.NODE_ENV === "production" && window.gtag) {
      window.gtag("event", "component_render", {
        component_name: componentName,
        render_time: renderTime,
        render_count: renderCount.current,
      });
    }
  });

  renderStartTime.current = performance.now();
};

/**
 * useIntersectionObserver Hook
 * Lazy load components when they enter viewport
 */
export const useIntersectionObserver = (options = {}) => {
  const ref = useRef(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          // Disconnect after first intersection for one-time load
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: "50px",
        ...options,
      },
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [options]);

  return [ref, isIntersecting];
};

/**
 * useDebounce Hook
 * Debounce expensive operations
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * useThrottle Hook
 * Throttle frequent events like scroll or resize
 */
export const useThrottle = (callback, delay = 100) => {
  const lastCall = useRef(0);

  return useCallback(
    (...args) => {
      const now = Date.now();
      if (now - lastCall.current >= delay) {
        lastCall.current = now;
        callback(...args);
      }
    },
    [callback, delay],
  );
};

/**
 * useMemoizedCallback Hook
 * Memoize expensive calculations
 */
export const useMemoizedCallback = (callback, deps) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    (...args) => callbackRef.current(...args),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );
};

/**
 * useVirtualList Hook
 * Virtualize long lists for better performance
 */
export const useVirtualList = (items, itemHeight, overscan = 5) => {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setContainerHeight(container.clientHeight);

    const handleScroll = () => setScrollTop(container.scrollTop);
    container.addEventListener("scroll", handleScroll);

    const resizeObserver = new ResizeObserver((entries) => {
      setContainerHeight(entries[0].contentRect.height);
    });
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, []);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan,
  );

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  return {
    containerRef,
    visibleItems,
    totalHeight,
    offsetY,
    startIndex,
    endIndex,
  };
};

const performanceExports = {
  usePerformanceMonitor,
  useIntersectionObserver,
  useDebounce,
  useThrottle,
  useMemoizedCallback,
  useVirtualList,
};

export default performanceExports;
