import { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "../utils/apiConfig";

const HEALTH_CHECK_TIMEOUT_MS = 10000; // Increased from 5s to 10s for production network latency

const resolveHealthCheckUrl = () => {
  const trimmedBaseUrl = String(API_BASE_URL || "").replace(/\/+$/, "");

  if (!trimmedBaseUrl) {
    return "/api/health";
  }

  if (trimmedBaseUrl.startsWith("/")) {
    return `${trimmedBaseUrl}/health`;
  }

  return new URL("health", `${trimmedBaseUrl}/`).toString();
};

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isBackendReachable, setIsBackendReachable] = useState(null);
  const abortControllerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const handleOnline = () => {
      if (mountedRef.current) setIsOnline(true);
    };
    const handleOffline = () => {
      if (mountedRef.current) setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check with a small delay to ensure component is mounted
    const initialCheckTimeout = setTimeout(() => {
      if (mountedRef.current) {
        checkBackendReachability();
      }
    }, 100);

    // Check backend reachability periodically (every 30 seconds)
    const interval = setInterval(() => {
      if (mountedRef.current) {
        checkBackendReachability();
      }
    }, 30000);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearTimeout(initialCheckTimeout);
      clearInterval(interval);
      // Abort any ongoing request on cleanup
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const checkBackendReachability = async () => {
    // Cancel previous request if still ongoing
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (e) {
        // Ignore abort errors
      }
    }

    // Skip check if component is unmounted
    if (!mountedRef.current) return;

    if (!navigator.onLine) {
      setIsBackendReachable(false);
      return;
    }

    const requestUrl = resolveHealthCheckUrl();
    const isAbsoluteRequest = /^https?:\/\//i.test(requestUrl);
    const isCrossOriginRequest =
      isAbsoluteRequest &&
      typeof window !== "undefined" &&
      !requestUrl.startsWith(window.location.origin);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let didTimeout = false;
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current === controller) {
        didTimeout = true;
        controller.abort();
      }
    }, HEALTH_CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(requestUrl, {
        method: "GET",
        mode: isCrossOriginRequest ? "cors" : "same-origin",
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Skip if component is unmounted
      if (!mountedRef.current) return;

      setIsBackendReachable(response.ok);
    } catch (error) {
      clearTimeout(timeoutId);

      // Skip if component is unmounted
      if (!mountedRef.current) return;

      if (error.name === "AbortError") {
        if (didTimeout) {
          console.warn("Backend reachability check timed out:", requestUrl);
          setIsBackendReachable(false);
        }
        return;
      } else if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed')) {
        // Network errors are common in production, just log and set to false
        console.warn("Backend reachability check failed (network error):", error.message);
        setIsBackendReachable(false);
      }

      console.warn("Backend reachability check failed:", error.message);
      setIsBackendReachable(false);
    } finally {
      clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  return {
    isOnline,
    isBackendReachable,
    checkBackendReachability,
  };
};
