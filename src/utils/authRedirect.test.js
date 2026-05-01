import {
  normalizeAuthUser,
  resolveRoleType,
  getDefaultAuthenticatedRouteFromRoleType,
  getDefaultAuthenticatedRouteFromUser,
  getDefaultAuthenticatedRouteFromFlags,
} from "./authRedirect";

describe("authRedirect utilities", () => {
  test("resolveRoleType maps canonical admin and healthcare roles", () => {
    expect(resolveRoleType("admin")).toBe("SYSTEM_ADMIN");
    expect(resolveRoleType("super_admin")).toBe("SYSTEM_ADMIN");
    expect(resolveRoleType("clinic_manager")).toBe("SYSTEM_ADMIN");
    expect(resolveRoleType("nurse")).toBe("SYSTEM_ADMIN");
    expect(resolveRoleType("guardian")).toBe("GUARDIAN");
    expect(resolveRoleType("user")).toBe("GUARDIAN");
  });

  test("normalizeAuthUser backfills role_type from role", () => {
    const normalized = normalizeAuthUser({
      id: 1,
      role: "admin",
      force_password_change: true,
    });

    expect(normalized.role).toBe("admin");
    expect(normalized.role_type).toBe("SYSTEM_ADMIN");
    expect(normalized.forcePasswordChange).toBe(true);
    expect(normalized.force_password_change).toBe(true);
  });

  test("getDefaultAuthenticatedRouteFromRoleType routes correctly", () => {
    expect(getDefaultAuthenticatedRouteFromRoleType("GUARDIAN")).toBe(
      "/guardian/dashboard",
    );
    expect(getDefaultAuthenticatedRouteFromRoleType("guardian")).toBe(
      "/guardian/dashboard",
    );
    expect(getDefaultAuthenticatedRouteFromRoleType("SYSTEM_ADMIN")).toBe(
      "/analytics",
    );
    expect(getDefaultAuthenticatedRouteFromRoleType("admin")).toBe(
      "/analytics",
    );
    expect(getDefaultAuthenticatedRouteFromRoleType(null)).toBe("/login");
  });

  test("getDefaultAuthenticatedRouteFromUser supports missing role_type payloads", () => {
    expect(
      getDefaultAuthenticatedRouteFromUser({
        id: 5,
        role: "guardian",
      }),
    ).toBe("/guardian/dashboard");

    expect(
      getDefaultAuthenticatedRouteFromUser({
        id: 2,
        role: "admin",
      }),
    ).toBe("/analytics");
  });

  test("getDefaultAuthenticatedRouteFromFlags routes by auth flags", () => {
    expect(
      getDefaultAuthenticatedRouteFromFlags({
        isGuardian: true,
        isAdmin: false,
      }),
    ).toBe("/guardian/dashboard");

    expect(
      getDefaultAuthenticatedRouteFromFlags({
        isGuardian: false,
        isAdmin: true,
      }),
    ).toBe("/analytics");

    expect(
      getDefaultAuthenticatedRouteFromFlags({
        isGuardian: false,
        isAdmin: false,
      }),
    ).toBe("/login");
  });
});
