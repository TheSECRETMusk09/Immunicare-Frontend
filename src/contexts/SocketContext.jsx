  import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { safeLocalStorage, safeSessionStorage } from "../utils/safeStorage";

// Use relative path for socket connection to work with webpack proxy
// The proxy in setupProxy.js handles forwarding /socket.io to localhost:5000
const getSocketUrl = () => {
  // Always use relative path to leverage the proxy in dev and same-origin in prod
  // unless an explicit external URL is provided
  return process.env.REACT_APP_SOCKET_URL || "/";
};

// Default socket configuration
const SOCKET_CONFIG = {
  path: "/socket.io",
  transports: ["websocket", "polling"], // Allow polling fallback
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: false // We connect manually in the provider
};

export const socket = io(getSocketUrl(), SOCKET_CONFIG);


const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState("disconnected"); // 'disconnected' | 'connecting' | 'connected' | 'error'
  const [notifications, setNotifications] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionError, setConnectionError] = useState(null);
  const isConnectingRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef(null);
  const maxReconnectAttempts = 5;

  // Play notification sound
  const playNotificationSound = useCallback((isCritical = false) => {
    try {
      const audio = new Audio(
        isCritical
          ? "/sounds/critical-notification.mp3"
          : "/sounds/notification.mp3",
      );
      audio.volume = 0.5;
      audio.play().catch((error) => {
        console.error("Error playing notification sound:", error);
      });
    } catch (error) {
      console.error("Error creating audio object:", error);
    }
  }, []);

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback(() => {
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(
      baseDelay * Math.pow(2, reconnectAttemptsRef.current),
      maxDelay,
    );
    return delay;
  }, []);

  // Initialize socket connection
  useEffect(() => {
    // Get token from storage using safe storage (same as api.js does)
    const token =
      safeLocalStorage.getItem("token") || safeSessionStorage.getItem("token");

    // Only connect if authenticated and token exists
    if (!token || !isAuthenticated) {
      setConnectionState("disconnected");
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || socketRef.current?.connected) {
      return;
    }

    // Clear any pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Set connecting state
    isConnectingRef.current = true;
    setConnectionState("connecting");

    // Delay connection to avoid race conditions during page load
    // Increased from 100ms to 800ms for better stability
    reconnectTimeoutRef.current = setTimeout(() => {
      if (isConnectingRef.current === false) {
        return;
      }

      // Development mode: Add random delay to prevent connection storms during HMR
      const isDev = process.env.NODE_ENV === "development";
      const socketUrl = getSocketUrl();

      const socket = io(socketUrl, {
        ...SOCKET_CONFIG,
        auth: {
          token: token,
        },
        reconnectionAttempts: isDev ? 3 : maxReconnectAttempts,
        reconnectionDelay: isDev ? 2000 : getReconnectDelay(),
        forceNew: true // Ensure fresh connection
      });

      socketRef.current = socket;

      // Connection handlers
      socket.on("connect", () => {
        console.log("Socket connected:", socket.id);
        socket.emit("authenticate", { token }); // Explicit auth event if needed
        setIsConnected(true);
        setConnectionState("connected");
        setConnectionError(null);
        isConnectingRef.current = false;
        reconnectAttemptsRef.current = 0;

        // Setup ping interval for connection health check
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = setInterval(() => {
          if (socket.connected) {
            socket.emit("ping", { timestamp: Date.now() });
          }
        }, 30000); // Ping every 30 seconds
      });

      socket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
        setIsConnected(false);
        setConnectionState("disconnected");
        
        if (reason === "io server disconnect") {
          // Server disconnected us, try to reconnect manually
          socket.connect();
        }
        isConnectingRef.current = false;

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Don't reset reconnect attempts on manual disconnect
        if (reason === "io client disconnect") {
          reconnectAttemptsRef.current = 0;
        }
      });

      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error.message);
        setIsConnected(false);
        setConnectionState("error");
        setConnectionError(error.message);
        isConnectingRef.current = false;
        
        if (error.message === "xhr poll error" || error.message === "websocket error") {
           // These are common network errors, just log them
           console.debug("Socket network error, will retry...");
        }
        reconnectAttemptsRef.current += 1;

        // Clear ping interval on error
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Silently fail after max attempts - socket is not critical
        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.warn("Max reconnection attempts reached. Giving up.");
          setConnectionState("error");
        }
      });

      // Handle reconnection events
      socket.on("reconnect_attempt", (attempt) => {
        setConnectionState("reconnecting");
      });

      // Handle pong response for health check
      socket.on("pong", (data) => {
        const latency = Date.now() - data.timestamp;
        console.log("Socket latency:", latency, "ms");
      });

      socket.on("connected", (data) => {
        console.log("Socket server acknowledged connection:", data);
      });

      // Notification handlers
      socket.on("notification", (data) => {
        console.log("New notification received:", data);
        setNotifications((prev) => [data.notification, ...prev]);
        setUnreadCount((prev) => prev + 1);

        // Play notification sound if enabled
        if (data.sound) {
          playNotificationSound();
        }
      });

      socket.on("critical-notification", (data) => {
        console.log("Critical notification received:", data);
        setNotifications((prev) => [data.notification, ...prev]);
        setUnreadCount((prev) => prev + 1);

        // Always play sound for critical notifications
        playNotificationSound(true);
      });

      socket.on("actionable-notification", (data) => {
        console.log("Actionable notification received:", data);
        setNotifications((prev) => [data.notification, ...prev]);
        setUnreadCount((prev) => prev + 1);
      });

      socket.on("alert", (data) => {
        console.log("New alert received:", data);
        setAlerts((prev) => [data.alert, ...prev]);
      });

      socket.on("critical-alert", (data) => {
        console.log("Critical alert received:", data);
        setAlerts((prev) => [data.alert, ...prev]);
        playNotificationSound(true);
      });

      socket.on("notification-updated", (data) => {
        console.log("Notification updated:", data);
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === data.notificationId ? { ...notif, ...data } : notif,
          ),
        );

        if (data.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      });

      socket.on("notification-deleted", (data) => {
        console.log("Notification deleted:", data);
        setNotifications((prev) =>
          prev.filter((notif) => notif.id !== data.notificationId),
        );
      });

      socket.on("notifications-read-all", (data) => {
        console.log("All notifications marked as read:", data);
        setNotifications((prev) =>
          prev.map((notif) => ({ ...notif, isRead: true })),
        );
        setUnreadCount(0);
      });

      socket.on("alert-resolved", (data) => {
        console.log("Alert resolved:", data);
        setAlerts((prev) => prev.filter((alert) => alert.id !== data.alertId));
      });

      // ========== Guardian-Admin Dashboard Sync Events ==========

      // Appointment update events (for Guardian-Admin sync)
      socket.on("appointment-created", (data) => {
        console.log("Appointment created (sync):", data);
        // Emit custom event for components to listen
        window.dispatchEvent(new CustomEvent("appointment-update", { detail: { action: "created", ...data } }));
      });

      socket.on("appointment-updated", (data) => {
        console.log("Appointment updated (sync):", data);
        window.dispatchEvent(new CustomEvent("appointment-update", { detail: { action: "updated", ...data } }));
      });

      socket.on("appointment-cancelled", (data) => {
        console.log("Appointment cancelled (sync):", data);
        window.dispatchEvent(new CustomEvent("appointment-update", { detail: { action: "cancelled", ...data } }));
      });

      // Vaccination record events (for Guardian-Admin sync)
      socket.on("vaccination-recorded", (data) => {
        console.log("Vaccination recorded (sync):", data);
        window.dispatchEvent(new CustomEvent("vaccination-update", { detail: { action: "recorded", ...data } }));
      });

      socket.on("vaccination-updated", (data) => {
        console.log("Vaccination updated (sync):", data);
        window.dispatchEvent(new CustomEvent("vaccination-update", { detail: { action: "updated", ...data } }));
      });

      // Guardian data sync events
      socket.on("guardian-data-changed", (data) => {
        console.log("Guardian data changed (sync):", data);
        window.dispatchEvent(new CustomEvent("guardian-data-update", { detail: data }));
      });

      // Child data sync events
      socket.on("child-data-changed", (data) => {
        console.log("Child data changed (sync):", data);
        window.dispatchEvent(new CustomEvent("child-data-update", { detail: data }));
      });
    }, 800); // Increased delay to 800ms for better page load stability

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (socketRef.current) {
        console.log("Socket: Cleaning up connection");
        socketRef.current.disconnect();
        socketRef.current.removeAllListeners();
        socketRef.current = null;
      }
      isConnectingRef.current = false;
    };
  }, [user, isAuthenticated, getReconnectDelay, playNotificationSound]);

  // Handle beforeunload to gracefully close connection
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socketRef.current) {
        console.log("Socket: Closing connection before page unload");
        socketRef.current.disconnect();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    reconnectAttemptsRef.current = 0;
    setConnectionState("connecting");
    // Trigger reconnection by updating a dependency
  }, []);

  // Join a room
  const joinRoom = useCallback((room) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("join-room", room);
    }
  }, [isConnected]);

  // Leave a room
  const leaveRoom = useCallback((room) => {
    if (socketRef.current) {
      socketRef.current.emit("leave-room", room);
    }
  }, []);

  // Mark notification as read
  const markNotificationAsRead = useCallback((notificationId) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("notification-read", { notificationId });
    }
  }, [isConnected]);

  // Dismiss notification
  const dismissNotification = useCallback((notificationId) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("notification-dismissed", { notificationId });
    }
  }, [isConnected]);

  // Send typing indicator
  const startTyping = useCallback((room) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("typing-start", { room });
    }
  }, [isConnected]);

  const stopTyping = useCallback((room) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("typing-stop", { room });
    }
  }, [isConnected]);

  // Emit custom event
  const emit = useCallback(
    (event, data) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(event, data);
      }
    },
    [isConnected],
  );

  // Listen to custom event
  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  // Remove custom event listener
  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  }, []);

  const value = {
    socket: socketRef.current,
    isConnected,
    connectionState,
    connectionError,
    notifications,
    alerts,
    unreadCount,
    reconnect,
    setNotifications,
    setAlerts,
    setUnreadCount,
    joinRoom,
    leaveRoom,
    markNotificationAsRead,
    dismissNotification,
    startTyping,
    stopTyping,
    playNotificationSound,
    emit,
    on,
    off,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export default SocketContext;
