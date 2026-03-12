#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const workspaceFrontendDir = path.resolve(__dirname, "..");
const mode = process.argv[2] || process.env.NODE_ENV || "development";
const isProduction = mode === "production";

const getEnvFilesByPriority = (runtimeEnv) => {
  const files = [`.env.${runtimeEnv}.local`, `.env.${runtimeEnv}`];

  if (runtimeEnv !== "test") {
    files.push(".env.local");
  }

  files.push(".env");
  return Array.from(new Set(files));
};

const loadedFiles = [];
const checkedFiles = [];
for (const envFile of getEnvFilesByPriority(mode)) {
  const absolutePath = path.join(workspaceFrontendDir, envFile);
  checkedFiles.push(envFile);
  if (fs.existsSync(absolutePath)) {
    dotenv.config({ path: absolutePath, override: false });
    loadedFiles.push(envFile);
  }
}

const isValidAbsoluteUrl = (value) => {
  try {
    const parsed = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const isValidRelativePath = (value) => {
  const trimmed = String(value || "").trim();
  return trimmed.startsWith("/");
};

const apiUrl = String(process.env.REACT_APP_API_URL || "").trim();
const socketUrl = String(process.env.REACT_APP_SOCKET_URL || "").trim();
const socketPath = String(process.env.REACT_APP_SOCKET_PATH || "").trim();

const errors = [];
const warnings = [];

if (isProduction) {
  if (!apiUrl) {
    errors.push("Missing required REACT_APP_API_URL for production build.");
  } else if (!isValidAbsoluteUrl(apiUrl) && !isValidRelativePath(apiUrl)) {
    errors.push(
      "REACT_APP_API_URL must be an absolute http(s) URL or explicit relative path starting with '/'.",
    );
  }

  if (!socketUrl) {
    errors.push("Missing required REACT_APP_SOCKET_URL for production build.");
  } else if (!isValidAbsoluteUrl(socketUrl) && !isValidRelativePath(socketUrl)) {
    errors.push(
      "REACT_APP_SOCKET_URL must be an absolute http(s) URL or explicit relative path starting with '/'.",
    );
  }

  if (!socketPath) {
    errors.push("Missing required REACT_APP_SOCKET_PATH for production build.");
  } else if (!socketPath.startsWith("/")) {
    errors.push("REACT_APP_SOCKET_PATH must start with '/'.");
  }
}

if (!process.env.REACT_APP_WS_URL) {
  // no-op; clean signal if old key still exists
} else {
  warnings.push(
    "Detected deprecated REACT_APP_WS_URL. Use REACT_APP_SOCKET_URL consistently.",
  );
}

if (warnings.length > 0) {
  for (const warning of warnings) {
    // eslint-disable-next-line no-console
    console.warn(`[env:warning] ${warning}`);
  }
}

if (errors.length > 0) {
  // eslint-disable-next-line no-console
  console.error(
    `[env:error] Frontend environment validation failed (${mode}).`,
  );
  console.error(`[env:error] Checked files (priority order): ${checkedFiles.join(", ")}`);
  console.error(`[env:error] Loaded files: ${loadedFiles.join(", ") || "none"}`);
  for (const error of errors) {
    // eslint-disable-next-line no-console
    console.error(`[env:error] ${error}`);
  }
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(
  `[env] Frontend environment validation passed (${mode}).`,
);
console.log(`[env] Checked files (priority order): ${checkedFiles.join(", ")}`);
console.log(`[env] Loaded files: ${loadedFiles.join(", ") || "none"}`);
