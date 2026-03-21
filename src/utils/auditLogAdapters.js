export const extractAuditLogsPayload = (response) => {
  const rootPayload = response?.data?.logs
    ? response.data
    : response?.logs
      ? response
      : response?.data && typeof response.data === "object"
        ? response.data
        : response || {};

  const logs = Array.isArray(rootPayload.logs)
    ? rootPayload.logs
    : Array.isArray(rootPayload.data)
      ? rootPayload.data
      : Array.isArray(rootPayload.rows)
        ? rootPayload.rows
        : [];

  const anomalies = Array.isArray(rootPayload.anomalies)
    ? rootPayload.anomalies
    : [];

  return {
    logs,
    anomalies,
    anomalyCount: Number(rootPayload.anomaly_count ?? anomalies.length ?? 0),
    summary: rootPayload.summary || null,
  };
};

const formatAuditDetails = (value) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const formatAuditLogRow = (log = {}) => ({
  id: log.id,
  timestamp: new Date(log.timestamp || log.created_at || Date.now()).toLocaleString(),
  user: log.username || log.user || log.user_id || "system",
  action: log.event_type || log.action_type || "UNKNOWN_EVENT",
  severity: String(log.severity || "INFO").toLowerCase(),
  ipAddress: log.ip_address || log.ipAddress || "N/A",
  details: formatAuditDetails(log.details || log.metadata || log.new_values || ""),
  success: log.success !== false,
});
