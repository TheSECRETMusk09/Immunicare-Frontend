import { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "../utils/apiConfig";

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

    try {
      // When using proxy, requests go through localhost:3000/api
      // When using direct mode, requests go to localhost:5000/api
      const isProxyMode = API_BASE_URL.startsWith("/api");
      const requestUrl = isProxyMode
        ? `${window.location.origin}/api/health`
        : `${API_BASE_URL}/health`;

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      const timeoutId = setTimeout(
        () => {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
        },
        5000, // 5 second timeout
      );

      // Use a lightweight endpoint to check connectivity
      const response = await fetch(requestUrl, {
        method: "GET",
        mode: isProxyMode ? "same-origin" : "cors",
        cache: "no-store",
        credentials: "omit", // Don't send cookies for health check
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        redirect: "follow",
        referrerPolicy: "no-referrer",
        signal: abortControllerRef.current.signal,
      });

      clearTimeout(timeoutId);

      // Skip if component is unmounted
      if (!mountedRef.current) return;

      setIsBackendReachable(response.ok);
    } catch (error) {
      // Skip if component is unmounted
      if (!mountedRef.current) return;

      // Handle abort error gracefully - don't treat as failure
      if (error.name === "AbortError") {
        // Request was aborted, which is normal during cleanup or timeout
        // Don't update state, just return silently
        return;
      }

      // Handle network errors gracefully
      console.warn("Backend reachability check failed:", error.message);
      setIsBackendReachable(false);
    }
  };

  return {
    isOnline,
    isBackendReachable,
    checkBackendReachability,
  };
};
