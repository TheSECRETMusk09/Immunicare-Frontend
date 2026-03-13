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
import { getStoredAccessToken } from "../utils/api";
import { SOCKET_URL, SOCKET_PATH } from "../utils/apiConfig";

// Use relative path for socket connection to work with webpack proxy
// The proxy in setupProxy.js handles forwarding /socket.io to localhost:5000
const getSocketUrl = () => {
  return SOCKET_URL;
};

// Default socket configuration
const SOCKET_CONFIG = {
  path: SOCKET_PATH,
  transports: ["websocket", "polling"], // Allow polling fallback
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: false // We connect manually in the provider
};

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
    const token = getStoredAccessToken();

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
        setIsConnected(true);
        setConnectionState("connected");
        setConnectionError(null);
        isConnectingRef.current = false;
        reconnectAttemptsRef.current = 0;
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

        if (data.isRead || data.status === "read") {
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
      const dispatchBrowserEvent = (name, detail) => {
        if (typeof window === "undefined") {
          return;
        }

        window.dispatchEvent(new CustomEvent(name, { detail }));
      };

      const toNormalizedStatus = (value) =>
        String(value || "")
          .trim()
          .toLowerCase()
          .replace(/-/g, "_");

      const handleAppointmentSync = (data, defaultAction = "updated") => {
        const normalizedStatus = toNormalizedStatus(data?.status || data?.raw_status);
        const action =
          normalizedStatus === "cancelled"
            ? "cancelled"
            : defaultAction;

        dispatchBrowserEvent("appointment-update", { action, ...data });
      };

      const handleVaccinationSync = (data, defaultAction = "updated") => {
        dispatchBrowserEvent("vaccination-update", { action: defaultAction, ...data });
      };

      const handleGuardianSync = (data, defaultAction = "updated") => {
        dispatchBrowserEvent("guardian-data-update", { action: defaultAction, ...data });
      };

      const handleChildSync = (data, defaultAction = "updated") => {
        dispatchBrowserEvent("child-data-update", { action: defaultAction, ...data });
      };

      socket.on("appointment_created", (data) => handleAppointmentSync(data, "created"));
      socket.on("appointment-created", (data) => handleAppointmentSync(data, "created"));
      socket.on("appointment_updated", (data) => handleAppointmentSync(data, "updated"));
      socket.on("appointment-updated", (data) => handleAppointmentSync(data, "updated"));
      socket.on("appointment_cancelled", (data) => handleAppointmentSync(data, "cancelled"));
      socket.on("appointment-cancelled", (data) => handleAppointmentSync(data, "cancelled"));
      socket.on("appointment_deleted", (data) => handleAppointmentSync(data, "deleted"));

      socket.on("vaccination_created", (data) => handleVaccinationSync(data, "recorded"));
      socket.on("vaccination-recorded", (data) => handleVaccinationSync(data, "recorded"));
      socket.on("vaccination_updated", (data) => handleVaccinationSync(data, "updated"));
      socket.on("vaccination-updated", (data) => handleVaccinationSync(data, "updated"));
      socket.on("vaccination_deleted", (data) => handleVaccinationSync(data, "deleted"));

      socket.on("guardian_updated", (data) => handleGuardianSync(data, "updated"));
      socket.on("guardian_created", (data) => handleGuardianSync(data, "created"));
      socket.on("guardian_deleted", (data) => handleGuardianSync(data, "deleted"));
      socket.on("guardian-data-changed", (data) => handleGuardianSync(data, "updated"));

      socket.on("infant_updated", (data) => handleChildSync(data, "updated"));
      socket.on("infant_created", (data) => handleChildSync(data, "created"));
      socket.on("infant_deleted", (data) => handleChildSync(data, "deleted"));
      socket.on("child-data-changed", (data) => handleChildSync(data, "updated"));
    }, 800); // Increased delay to 800ms for better page load stability

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
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
    reconnectAttemptsRef.current = 0;
    setConnectionState("connecting");

    if (socketRef.current) {
      socketRef.current.connect();
    }
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
