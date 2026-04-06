const toLowerValue = (value) =>
  typeof value === "string" ? value.toLowerCase() : "";

const normalizeCandidateValue = (value) =>
  toLowerValue(value)
    .replace(/\s+/g, "_")
    .trim();

const includesAny = (text, terms) =>
  terms.some((term) => text.includes(term));

const parseMaybeJson = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === "object") {
    return value;
  }

  if (typeof value !== "string") {
    return {};
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return {};
  }
};

const getMetadataPayload = (raw = {}) => {
  const metadata = parseMaybeJson(raw?.metadata);
  const templateData = parseMaybeJson(raw?.template_data);

  return {
    metadata,
    templateData,
    payload:
      metadata?.payload || metadata?.data || templateData?.payload || templateData,
  };
};

const pickFirstNonEmptyValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return null;
};

export const CATEGORY_META = Object.freeze({
  appointment: { label: "Appointments", icon: "📅" },
  vaccination_schedule: { label: "Vaccination Schedules", icon: "💉" },
  missed_schedule: { label: "Missed Schedules", icon: "⏰" },
  inventory_low_stock: { label: "Low Vaccine Stock", icon: "📦" },
  inventory_out_of_stock: { label: "Out-of-Stock Vaccines", icon: "🚨" },
  guardian_registration: { label: "Guardian Registrations", icon: "👨‍👩‍👧" },
  infant_registration: { label: "Infant Registrations", icon: "👶" },
  report: { label: "Reports", icon: "📊" },
  system_announcement: { label: "System Announcements", icon: "📢" },
  outbound_message_failed: { label: "Failed Outbound Messages", icon: "📵" },
  general: { label: "General", icon: "🔔" },
});

export const CATEGORY_FILTER_OPTIONS = [
  { value: "all", label: "All categories" },
  ...Object.entries(CATEGORY_META)
    .filter(([value]) => value !== "general")
    .map(([value, meta]) => ({ value, label: meta.label })),
  { value: "general", label: "General" },
];

export const GUARDIAN_CATEGORY_META = Object.freeze({
  appointment: { label: "Appointments", icon: "📅" },
  vaccination_update: { label: "Vaccination Updates", icon: "💉" },
  reminder: { label: "Reminders", icon: "⏰" },
  health_alert: { label: "Health Alerts", icon: "🚨" },
  general: { label: "Announcements", icon: "🔔" },
});

export const GUARDIAN_CATEGORY_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  ...Object.entries(GUARDIAN_CATEGORY_META).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

const CATEGORY_ALIASES = Object.freeze({
  appointment: [
    "appointment",
    "appointments",
    "appointment_confirmation",
    "appointment_confirmed",
    "appointment_reminder",
    "appointment_status",
    "appointment_status_changed",
    "appointment_update",
    "appointment_updated",
    "appointment_rescheduled",
    "appointment_cancelled",
    "appointment_suggested",
  ],
  vaccination_schedule: [
    "vaccination_schedule",
    "vaccination_reminder",
    "vaccination_due",
    "immunization_schedule",
    "schedule_due",
    "vaccine_due",
    "upcoming_vaccine",
    "next_vaccine_computed",
    "vaccine_administered",
  ],
  missed_schedule: [
    "missed_schedule",
    "missed_appointment",
    "missed_vaccine",
    "overdue_vaccination",
    "vaccine_overdue",
  ],
  inventory_low_stock: [
    "low_stock",
    "inventory_low_stock",
    "low_stock_alert",
    "expiry_warning",
    "expiry_critical",
    "stock_warning",
    "stock_alert",
  ],
  inventory_out_of_stock: [
    "out_of_stock",
    "inventory_out_of_stock",
    "stock_unavailable",
    "vaccine_non_availability",
    "critical_stock_alert",
    "out_of_stock_alert",
  ],
  guardian_registration: [
    "guardian_registration",
    "guardian_registered",
    "guardian_account_created",
  ],
  infant_registration: [
    "infant_registration",
    "infant_registered",
    "child_registration_success",
    "child_registered",
    "infant_created",
    "transfer_in_submitted",
  ],
  report: ["report", "report_ready", "report_generated", "report_exported"],
  system_announcement: ["system_announcement", "announcement", "admin_announcement"],
  outbound_message_failed: [
    "outbound_message_failed",
    "sms_failed",
    "email_failed",
    "delivery_failed",
    "failed_outbound_message",
    "failed_sms",
  ],
  general: ["general", "notification", "auth", "security"],
});

const GUARDIAN_CATEGORY_ALIASES = Object.freeze({
  appointment: [
    "appointment",
    "appointments",
    "appointment_confirmation",
    "appointment_confirmed",
    "appointment_status",
    "appointment_status_changed",
    "appointment_update",
    "appointment_updated",
    "appointment_rescheduled",
    "appointment_cancelled",
    "appointment_suggested",
    "sms_confirmation_sent",
  ],
  vaccination_update: [
    "vaccine_administered",
    "infant_registration",
    "infant_registered",
    "child_registration_success",
    "child_registered",
    "infant_created",
    "transfer_in",
    "transfer_in_submitted",
  ],
  reminder: [
    "appointment_reminder",
    "vaccination_reminder",
    "vaccination_schedule",
    "vaccination_due",
    "immunization_schedule",
    "schedule_due",
    "vaccine_due",
    "upcoming_vaccine",
    "next_vaccine_computed",
    "missed_schedule",
    "missed_appointment",
    "missed_vaccine",
    "overdue_vaccination",
    "vaccine_overdue",
  ],
  health_alert: ["health_alert"],
  general: [
    "system_announcement",
    "announcement",
    "admin_announcement",
    "new_message",
    "profile_update",
    "general",
    "notification",
    "auth",
    "security",
  ],
});

const GUARDIAN_BLOCKED_ALIASES = Object.freeze([
  "low_stock",
  "inventory_low_stock",
  "low_stock_alert",
  "expiry_warning",
  "expiry_critical",
  "stock_warning",
  "stock_alert",
  "out_of_stock",
  "inventory_out_of_stock",
  "stock_unavailable",
  "vaccine_non_availability",
  "critical_stock_alert",
  "out_of_stock_alert",
  "guardian_registration",
  "guardian_registered",
  "guardian_account_created",
  "report",
  "report_ready",
  "report_generated",
  "report_exported",
  "outbound_message_failed",
  "sms_failed",
  "email_failed",
  "delivery_failed",
  "failed_outbound_message",
  "failed_sms",
  "inventory_alert",
  "supplier_update",
  "analytics_alert",
  "staff_action",
  "system_alert",
]);

const GUARDIAN_APPOINTMENT_REMINDER_TYPES = new Set([
  "appointment_reminder",
  "missed_schedule",
  "missed_appointment",
]);

const GUARDIAN_CHILD_RECORD_UPDATE_TYPES = new Set([
  "infant_registration",
  "infant_registered",
  "child_registration_success",
  "child_registered",
  "infant_created",
  "transfer_in",
  "transfer_in_submitted",
]);

const buildNotificationSearchText = (raw = {}, sourceText = "") => {
  const { metadata, templateData, payload } = getMetadataPayload(raw);

  return [
    raw?.title,
    raw?.subject,
    raw?.event_title,
    raw?.event,
    raw?.message,
    raw?.content,
    raw?.description,
    raw?.body,
    raw?.category,
    raw?.notification_type,
    raw?.event_type,
    raw?.type,
    metadata?.message,
    metadata?.title,
    payload?.message,
    payload?.title,
    payload?.childName,
    payload?.guardianName,
    templateData?.message,
    sourceText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

export const mapExplicitNotificationCategory = (value) => {
  const normalized = normalizeCandidateValue(value);

  if (!normalized || normalized === "registration" || normalized === "system_alert") {
    return null;
  }

  for (const [category, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.includes(normalized)) {
      return category;
    }
  }

  return null;
};

export const inferNotificationCategoryFromText = (text = "") => {
  const normalizedText = String(text || "").toLowerCase();

  if (
    includesAny(normalizedText, [
      "out of stock",
      "out-of-stock",
      "stockout",
      "no doses",
      "depleted",
      "unavailable vaccine",
      "vaccine unavailable",
    ])
  ) {
    return "inventory_out_of_stock";
  }

  if (
    includesAny(normalizedText, [
      "low stock",
      "below threshold",
      "running low",
      "inventory alert",
      "stock alert",
    ])
  ) {
    return "inventory_low_stock";
  }

  if (
    includesAny(normalizedText, [
      "sms failed",
      "email failed",
      "failed delivery",
      "failed outbound",
      "undelivered",
      "delivery failure",
      "message failure",
      "bounce",
    ])
  ) {
    return "outbound_message_failed";
  }

  if (
    includesAny(normalizedText, [
      "missed schedule",
      "missed appointment",
      "did not attend",
      "no show",
      "overdue schedule",
      "overdue vaccine",
    ])
  ) {
    return "missed_schedule";
  }

  if (
    includesAny(normalizedText, [
      "vaccination schedule",
      "immunization schedule",
      "vaccine due",
      "due for vaccine",
      "upcoming dose",
      "schedule reminder",
      "next vaccine",
    ])
  ) {
    return "vaccination_schedule";
  }

  if (includesAny(normalizedText, ["appointment", "booked", "rescheduled"])) {
    return "appointment";
  }

  if (
    includesAny(normalizedText, [
      "guardian registered",
      "guardian registration",
      "guardian account",
      "new guardian",
      "parent registered",
    ])
  ) {
    return "guardian_registration";
  }

  if (
    includesAny(normalizedText, [
      "infant registered",
      "infant registration",
      "child registration",
      "new infant",
      "newborn",
      "child registered",
      "baby registered",
      "transfer-in",
    ])
  ) {
    return "infant_registration";
  }

  if (
    includesAny(normalizedText, [
      "report generated",
      "report ready",
      "report notification",
      "analytics export",
      "summary report",
    ])
  ) {
    return "report";
  }

  if (
    includesAny(normalizedText, [
      "announcement",
      "system maintenance",
      "scheduled maintenance",
      "system update",
      "platform notice",
      "downtime",
    ])
  ) {
    return "system_announcement";
  }

  return "general";
};

const mapGuardianExplicitNotificationCategory = (value) => {
  const normalized = normalizeCandidateValue(value);

  if (!normalized) {
    return null;
  }

  if (GUARDIAN_BLOCKED_ALIASES.includes(normalized)) {
    return false;
  }

  for (const [category, aliases] of Object.entries(GUARDIAN_CATEGORY_ALIASES)) {
    if (aliases.includes(normalized)) {
      return category;
    }
  }

  return null;
};

const inferGuardianNotificationCategoryFromText = (text = "") => {
  const normalizedText = String(text || "").toLowerCase();

  if (
    includesAny(normalizedText, [
      "low stock",
      "out of stock",
      "inventory alert",
      "stock alert",
      "failed outbound",
      "delivery failure",
      "report generated",
      "report ready",
      "guardian registration",
      "new guardian",
    ])
  ) {
    return null;
  }

  if (
    includesAny(normalizedText, [
      "health alert",
      "seek immediate care",
      "urgent health",
      "emergency",
      "adverse reaction",
    ])
  ) {
    return "health_alert";
  }

  if (
    includesAny(normalizedText, [
      "vaccination reminder",
      "vaccination due",
      "due for vaccine",
      "upcoming dose",
      "next vaccine",
      "missed schedule",
      "missed appointment",
      "overdue vaccine",
      "reminder",
    ])
  ) {
    return "reminder";
  }

  if (
    includesAny(normalizedText, [
      "vaccine administered",
      "vaccination recorded",
      "child registered",
      "infant registration",
      "transfer-in",
      "transferred",
    ])
  ) {
    return "vaccination_update";
  }

  if (
    includesAny(normalizedText, [
      "appointment",
      "rescheduled",
      "booked",
      "confirmed",
      "cancelled",
    ])
  ) {
    return "appointment";
  }

  if (
    includesAny(normalizedText, [
      "announcement",
      "system maintenance",
      "system update",
      "message from",
      "profile updated",
      "security",
    ])
  ) {
    return "general";
  }

  return null;
};

export const resolveGuardianNotificationCategory = (raw, options = {}) => {
  if (typeof raw === "string") {
    const explicitCategory = mapGuardianExplicitNotificationCategory(raw);
    if (explicitCategory !== null) {
      return explicitCategory || null;
    }

    return inferGuardianNotificationCategoryFromText(options.sourceText || raw);
  }

  const sourceText = buildNotificationSearchText(raw, options.sourceText);
  const explicitCandidates = [
    raw?.category,
    raw?.notification_type,
    raw?.event_type,
    raw?.type,
  ];

  for (const candidate of explicitCandidates) {
    const explicitCategory = mapGuardianExplicitNotificationCategory(candidate);
    if (explicitCategory !== null) {
      return explicitCategory || null;
    }
  }

  const ambiguousCategory = normalizeCandidateValue(raw?.category);
  if (ambiguousCategory === "registration") {
    if (includesAny(sourceText, ["infant", "child", "newborn", "baby", "transfer-in"])) {
      return "vaccination_update";
    }

    if (includesAny(sourceText, ["guardian", "parent"])) {
      return null;
    }
  }

  return inferGuardianNotificationCategoryFromText(sourceText);
};

export const isGuardianVisibleNotification = (raw = {}) =>
  Boolean(resolveGuardianNotificationCategory(raw, { isGuardian: true }));

const resolveDefaultNotificationCategory = (raw, options = {}) => {
  if (typeof raw === "string") {
    return (
      mapExplicitNotificationCategory(raw) ||
      inferNotificationCategoryFromText(options.sourceText || raw)
    );
  }

  const sourceText = buildNotificationSearchText(raw, options.sourceText);

  const explicit = [
    mapExplicitNotificationCategory(raw?.category),
    mapExplicitNotificationCategory(raw?.notification_type),
    mapExplicitNotificationCategory(raw?.event_type),
    mapExplicitNotificationCategory(raw?.type),
  ].find(Boolean);

  if (explicit) {
    return explicit;
  }

  const ambiguousCategory = normalizeCandidateValue(raw?.category);
  if (ambiguousCategory === "registration") {
    if (includesAny(sourceText, ["infant", "child", "newborn", "baby"])) {
      return "infant_registration";
    }

    if (includesAny(sourceText, ["guardian", "parent"])) {
      return "guardian_registration";
    }
  }

  return inferNotificationCategoryFromText(sourceText);
};

export const resolveNotificationCategory = (raw, options = {}) => {
  if (options.isGuardian) {
    return resolveGuardianNotificationCategory(raw, options) || "general";
  }

  return resolveDefaultNotificationCategory(raw, options);
};

export const resolveExplicitNotificationUrl = (raw = {}) => {
  const value = pickFirstNonEmptyValue(
    raw?.action_url,
    raw?.actionUrl,
    raw?.target_url,
    raw?.url,
    raw?.link,
  );

  return value ? String(value).trim() : null;
};

export const isExternalNotificationUrl = (value) =>
  /^https?:\/\//i.test(String(value || "").trim());

const getRelatedEntityType = (raw = {}) =>
  normalizeCandidateValue(
    pickFirstNonEmptyValue(raw?.related_entity_type, raw?.relatedEntityType),
  );

const getRelatedEntityId = (raw = {}) => {
  const { metadata, payload } = getMetadataPayload(raw);

  return pickFirstNonEmptyValue(
    raw?.related_entity_id,
    raw?.relatedEntityId,
    raw?.appointment_id,
    raw?.appointmentId,
    payload?.appointmentId,
    payload?.appointment_id,
    payload?.relatedEntityId,
    payload?.related_entity_id,
    metadata?.appointmentId,
  );
};

const getInfantId = (raw = {}) => {
  const { metadata, payload, templateData } = getMetadataPayload(raw);

  return pickFirstNonEmptyValue(
    raw?.infant_id,
    raw?.infantId,
    raw?.child_id,
    raw?.childId,
    payload?.infantId,
    payload?.infant_id,
    payload?.childId,
    payload?.child_id,
    templateData?.infantId,
    templateData?.infant_id,
    templateData?.childId,
    templateData?.child_id,
    metadata?.infantId,
    metadata?.infant_id,
    metadata?.childId,
    metadata?.child_id,
    getRelatedEntityType(raw) === "infant" ? getRelatedEntityId(raw) : null,
    getRelatedEntityType(raw) === "child" ? getRelatedEntityId(raw) : null,
    getRelatedEntityType(raw) === "patient" ? getRelatedEntityId(raw) : null,
  );
};

export const resolveNotificationActionUrl = (raw, options = {}) => {
  const explicitUrl = resolveExplicitNotificationUrl(raw);
  if (explicitUrl) {
    return explicitUrl;
  }

  const category = resolveNotificationCategory(raw, options);
  const notificationType = normalizeCandidateValue(
    pickFirstNonEmptyValue(raw?.notification_type, raw?.event_type, raw?.type),
  );
  const relatedEntityType = getRelatedEntityType(raw);
  const relatedEntityId = getRelatedEntityId(raw);
  const infantId = getInfantId(raw);

  if (options.isGuardian) {
    if (notificationType === "new_message") {
      return "/guardian/messages";
    }

    if (notificationType === "profile_update") {
      return "/guardian/profile";
    }

    if (notificationType === "health_alert") {
      return infantId ? `/guardian/children/${infantId}` : "/guardian/children";
    }

    switch (category) {
      case "appointment":
        if (relatedEntityType === "appointment" && relatedEntityId) {
          return `/guardian/appointments/${relatedEntityId}`;
        }
        return infantId
          ? `/guardian/appointments?childId=${infantId}`
          : "/guardian/appointments";
      case "vaccination_update":
        if (GUARDIAN_CHILD_RECORD_UPDATE_TYPES.has(notificationType)) {
          return infantId ? `/guardian/children/${infantId}` : "/guardian/children";
        }
        return infantId
          ? `/guardian/immunization-chart/${infantId}`
          : "/guardian/immunization-chart";
      case "reminder":
        if (
          relatedEntityType === "appointment" ||
          GUARDIAN_APPOINTMENT_REMINDER_TYPES.has(notificationType)
        ) {
          return infantId
            ? `/guardian/appointments?childId=${infantId}`
            : "/guardian/appointments";
        }
        return infantId
          ? `/guardian/immunization-chart/${infantId}`
          : "/guardian/immunization-chart";
      case "health_alert":
        return infantId ? `/guardian/children/${infantId}` : "/guardian/children";
      case "general":
      default:
        return "/guardian/notifications";
    }
  }

  switch (category) {
    case "appointment":
    case "missed_schedule":
      return "/appointments";
    case "vaccination_schedule":
      return "/vaccination-management";
    case "inventory_low_stock":
    case "inventory_out_of_stock":
      return "/inventory";
    case "guardian_registration":
      return "/users?tab=guardians";
    case "infant_registration":
      return "/infants";
    case "report":
      return "/reports";
    case "system_announcement":
      return "/announcements";
    case "outbound_message_failed":
      return "/notifications?category=outbound_message_failed&status=failed";
    case "general":
    default:
      return "/dashboard";
  }
};

const notificationRouting = {
  CATEGORY_META,
  CATEGORY_FILTER_OPTIONS,
  GUARDIAN_CATEGORY_META,
  GUARDIAN_CATEGORY_FILTER_OPTIONS,
  inferNotificationCategoryFromText,
  isGuardianVisibleNotification,
  isExternalNotificationUrl,
  mapExplicitNotificationCategory,
  resolveExplicitNotificationUrl,
  resolveGuardianNotificationCategory,
  resolveNotificationActionUrl,
  resolveNotificationCategory,
};

export default notificationRouting;
