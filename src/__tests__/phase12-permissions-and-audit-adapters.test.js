import {
  buildPermissionCapabilities,
  hasAnyPermission,
  hasPermission,
  normalizePermissions,
} from "../utils/authPermissions";
import {
  extractAuditLogsPayload,
  formatAuditLogRow,
} from "../utils/auditLogAdapters";

describe("phase 12 permission helpers", () => {
  test("normalizes permissions and exposes workflow capabilities", () => {
    const permissions = normalizePermissions([
      "transfer:validate",
      "inventory:correct",
      "system:audit",
      "report:create",
      "transfer:validate",
    ]);

    expect(permissions).toEqual([
      "transfer:validate",
      "inventory:correct",
      "system:audit",
      "report:create",
    ]);
    expect(hasPermission(permissions, "transfer:validate")).toBe(true);
    expect(hasAnyPermission(permissions, ["admin:override", "report:create"])).toBe(true);

    expect(buildPermissionCapabilities(permissions)).toMatchObject({
      canValidateTransfers: true,
      canCorrectInventory: true,
      canGenerateReports: true,
      canViewAuditLogs: true,
      canUseAdminOverrides: false,
    });
  });
});

describe("phase 12 audit log adapters", () => {
  test("extracts audit log collections from wrapped API payloads", () => {
    const payload = extractAuditLogsPayload({
      success: true,
      data: {
        logs: [
          {
            id: 7,
            username: "admin.user",
            event_type: "APPOINTMENT_UPDATED",
            severity: "CRITICAL",
          },
        ],
        anomalies: [{ id: 7 }],
        anomaly_count: 1,
      },
    });

    expect(payload.logs).toHaveLength(1);
    expect(payload.anomalies).toHaveLength(1);
    expect(payload.anomalyCount).toBe(1);
  });

  test("formats audit log rows for UI tables", () => {
    const row = formatAuditLogRow({
      id: 11,
      username: "nurse.audit",
      event_type: "INVENTORY_CORRECTION_APPLIED",
      severity: "WARNING",
      ip_address: "127.0.0.1",
      details: { quantity: 3 },
      timestamp: "2026-03-21T01:00:00.000Z",
    });

    expect(row).toMatchObject({
      id: 11,
      user: "nurse.audit",
      action: "INVENTORY_CORRECTION_APPLIED",
      severity: "warning",
      ipAddress: "127.0.0.1",
      details: JSON.stringify({ quantity: 3 }),
    });
  });
});
