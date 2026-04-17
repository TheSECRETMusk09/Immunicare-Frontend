export const adminRoutePaths = Object.freeze({
  dashboard: "/dashboard",
  analytics: "/analytics",
  users: "/users",
  infants: "/infants",
  vaccinations: "/vaccination-management",
  transferInCases: "/transfer-in-cases",
  inventory: "/inventory",
  appointments: "/appointments",
  reports: "/reports",
  announcements: "/announcements",
  notifications: "/notifications",
  settings: "/settings",
});

export const guardianRoutePaths = Object.freeze({
  dashboard: "/guardian/dashboard",
  children: "/guardian/children",
  appointments: "/guardian/appointments",
  appointmentBookingBase: "/guardian/appointments/new",
  appointmentBooking: (childId = null) =>
    childId
      ? `/guardian/appointments/new?childId=${childId}`
      : "/guardian/appointments/new",
  appointmentBookingAlias: "/guardian/appointments/book",
  vaccinationRecords: "/guardian/vaccination-records",
  vaccinationRecordsByChild: (childId) => `/guardian/vaccination-records/${childId}`,
  immunizationChart: "/guardian/immunization-chart",
  documents: "/guardian/documents",
  notifications: "/guardian/notifications",
  profile: "/guardian/profile",
  settings: "/guardian/settings",
});

export const legacyRouteRedirects = Object.freeze({
  // Retained for backward compatibility with older links if needed.
});
