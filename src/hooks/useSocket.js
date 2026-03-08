// Re-export useSocket from SocketContext for backward compatibility
// This hook now uses the centralized SocketContext instead of creating its own connection
import { useSocket } from "../contexts/SocketContext";

export default useSocket;
