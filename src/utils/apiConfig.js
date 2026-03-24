const DEFAULT_DEV_API_BASE_URL = "/api";
const DEFAULT_DEV_SOCKET_URL = "/";
const DEFAULT_SOCKET_PATH = "/socket.io";

const removeTrailingSlash = (value) => value.replace(/\/+$/, "");

const parseConfiguredOrigins = (...values) => {
  return values
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
};

const isProductionBuild = process.env.NODE_ENV === "production";

const normalizeAbsoluteUrl = (rawValue) => {
  try {
    const parsed = new URL(String(rawValue || "").trim());
    return removeTrailingSlash(parsed.toString());
  } catch {
    return null;
  }
};

export const normalizeApiBaseUrl = (rawUrl = process.env.REACT_APP_API_URL) => {
  const trimmedUrl = String(rawUrl || "").trim();

  if (!trimmedUrl) {
    return null;
  }

  if (trimmedUrl.startsWith("/")) {
    return removeTrailingSlash(trimmedUrl) || "/";
  }

  // Ignore absolute URLs in development to enforce proxy usage
  if (!isProductionBuild) {
    return null;
  }

  const normalizedAbsoluteUrl = normalizeAbsoluteUrl(trimmedUrl);
  if (!normalizedAbsoluteUrl) {
    return null;
  }

  const parsed = new URL(normalizedAbsoluteUrl);
  if (!parsed.pathname || parsed.pathname === "/") {
    parsed.pathname = "/api";
  }

  return removeTrailingSlash(parsed.toString());
};

export const normalizeSocketUrl = (rawUrl = process.env.REACT_APP_SOCKET_URL) => {
  const trimmedUrl = String(rawUrl || "").trim();

  if (!trimmedUrl) {
    return null;
  }

  if (trimmedUrl.startsWith("/")) {
    return removeTrailingSlash(trimmedUrl) || "/";
  }

  return normalizeAbsoluteUrl(trimmedUrl);
};

export const normalizeSocketPath = (rawPath = process.env.REACT_APP_SOCKET_PATH) => {
  const value = String(rawPath || DEFAULT_SOCKET_PATH).trim();
  if (!value.startsWith("/")) {
    return null;
  }

  return removeTrailingSlash(value) || "/";
};

const resolveApiBaseUrl = () => {
  const configured = normalizeApiBaseUrl(process.env.REACT_APP_API_URL);

  if (configured) {
    return configured;
  }

  if (isProductionBuild) {
    throw new Error(
      "Missing or invalid REACT_APP_API_URL. Production builds require an explicit API base URL.",
    );
  }

  return DEFAULT_DEV_API_BASE_URL;
};

const resolveSocketUrl = () => {
  const configured = normalizeSocketUrl(process.env.REACT_APP_SOCKET_URL);

  if (configured) {
    return configured;
  }

  if (isProductionBuild) {
    throw new Error(
      "Missing or invalid REACT_APP_SOCKET_URL. Production builds require an explicit socket base URL.",
    );
  }

  return DEFAULT_DEV_SOCKET_URL;
};

const resolveSocketPath = () => {
  const configured = normalizeSocketPath(process.env.REACT_APP_SOCKET_PATH);

  if (configured) {
    return configured;
  }

  if (isProductionBuild) {
    throw new Error(
      "Invalid REACT_APP_SOCKET_PATH. Production builds require a socket path that starts with '/'.",
    );
  }

  return DEFAULT_SOCKET_PATH;
};

export const API_BASE_URL = resolveApiBaseUrl();
export const SOCKET_URL = resolveSocketUrl();
export const SOCKET_PATH = resolveSocketPath();

export const getAllowedFrontendOrigins = () => {
  return parseConfiguredOrigins(
    process.env.REACT_APP_FRONTEND_URL,
    process.env.REACT_APP_APP_URL,
  );
};
