const DEFAULT_API_BASE_URL = "/api";

const removeTrailingSlash = (value) => value.replace(/\/+$/, "");

const parseConfiguredOrigins = (...values) => {
  return values
    .filter(Boolean)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
};

export const normalizeApiBaseUrl = (
  rawUrl = process.env.REACT_APP_API_URL || DEFAULT_API_BASE_URL,
) => {
  const trimmedUrl = (rawUrl || "").trim();

  if (!trimmedUrl) {
    return DEFAULT_API_BASE_URL;
  }

  // Relative paths are typically handled by CRA proxy in development.
  if (trimmedUrl.startsWith("/")) {
    return removeTrailingSlash(trimmedUrl) || DEFAULT_API_BASE_URL;
  }

  // Absolute URLs can be configured with or without the /api suffix.
  try {
    const parsed = new URL(trimmedUrl);
    if (!parsed.pathname || parsed.pathname === "/") {
      parsed.pathname = "/api";
    }
    return removeTrailingSlash(parsed.toString());
  } catch {
    // Fallback for malformed values: keep behavior predictable.
    return DEFAULT_API_BASE_URL;
  }
};

export const API_BASE_URL = normalizeApiBaseUrl();

export const getAllowedFrontendOrigins = () => {
  return parseConfiguredOrigins(
    process.env.REACT_APP_FRONTEND_URL,
    process.env.REACT_APP_APP_URL,
  );
};

