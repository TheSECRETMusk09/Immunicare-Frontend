const { createProxyMiddleware } = require("http-proxy-middleware");
const fs = require("fs");
const path = require("path");

const DEFAULT_BACKEND_PORT = Number.parseInt(process.env.BACKEND_PORT || "5000", 10) || 5000;

const resolveBackendTarget = () => {
  const configuredTarget = process.env.BACKEND_TARGET_URL;
  if (configuredTarget && configuredTarget.trim()) {
    return configuredTarget.trim();
  }

  const runtimePortStateFile = path.resolve(__dirname, "../../backend/.runtime/active-port.json");

  try {
    if (fs.existsSync(runtimePortStateFile)) {
      const runtime = JSON.parse(fs.readFileSync(runtimePortStateFile, "utf8"));
      const port = Number.parseInt(runtime?.port, 10);
      const status = String(runtime?.status || "").toLowerCase();
      if (Number.isFinite(port) && port > 0 && status === "running") {
        return `http://localhost:${port}`;
      }
    }
  } catch (_error) {
    // Fall back to the default target when runtime state can't be read.
  }

  return `http://localhost:${DEFAULT_BACKEND_PORT}`;
};

module.exports = function (app) {
  const backendTarget = resolveBackendTarget();

  // Common proxy options for backend
  const backendProxyOptions = {
    target: backendTarget,
    router: () => resolveBackendTarget(),
    changeOrigin: true,
    logLevel: "warn",
    timeout: 30000,
    proxyTimeout: 30000,
    onError: (err, req, res) => {
      // Suppress ECONNRESET and ECONNREFUSED errors during hot reload/restart
      const isNetworkError = err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED';

      if (!isNetworkError) {
        console.error('Proxy Error:', err);
      }

      // Send a proper error response to the client so the request doesn't hang
      if (res && res.writeHead && !res.headersSent) {
        res.writeHead(502, {
          'Content-Type': 'application/json',
          'X-Proxy-Error': err.code
        });
        res.end(JSON.stringify({
          error: 'Proxy Error',
          message: 'Backend server is unreachable',
          code: err.code
        }));
      }
    }
  };

  // Socket.IO WebSocket proxy - MUST come before HTTP proxy
  // This handles WebSocket upgrade requests for /socket.io
  const socketProxy = createProxyMiddleware({
    ...backendProxyOptions,
    ws: true,
    changeOrigin: true,
  });

  // HTTP API proxy - handles regular HTTP requests to /api
  const apiProxy = createProxyMiddleware(backendProxyOptions);

  // Apply Socket.IO proxy FIRST (before HTTP proxy)
  // This ensures WebSocket upgrade requests are handled correctly
  app.use("/socket.io", socketProxy);

  // Apply API proxy for all other backend requests
  app.use("/api", apiProxy);

  // IMPORTANT: Do NOT add a proxy for /ws
  // Webpack Dev Server uses /ws for Hot Module Replacement (HMR)
  // These requests should be handled by the dev server itself, NOT proxied to backend
  // The webpack dev server runs on the same port (3000) and handles /ws internally
};
