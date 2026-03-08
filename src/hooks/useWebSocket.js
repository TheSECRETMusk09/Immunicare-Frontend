// Re-export useSocket from SocketContext for backward compatibility
// This hook now uses the centralized SocketContext instead of creating its own connection
// The useSocket hook provides all the same functionality as the old useWebSocket hook
import { useSocket } from "../contexts/SocketContext";

export default useSocket;
