import {
  isGuardianVisibleNotification,
  resolveNotificationActionUrl,
  resolveNotificationCategory,
} from "../utils/notificationRouting";

describe("notification routing", () => {
  test("maps admin appointment notifications to the appointments module", () => {
    const notification = {
      notification_type: "appointment_confirmation",
      title: "Appointment Confirmed",
      message: "Baby A has an appointment tomorrow.",
    };

    expect(resolveNotificationCategory(notification)).toBe("appointment");
    expect(resolveNotificationActionUrl(notification)).toBe("/appointments?period=month");
  });

  test("enriches admin appointment notifications with month period and infant search", () => {
    const notification = {
      notification_type: "appointment_created",
      action_url: "/appointments?period=today",
      title: "Guardian created appointment",
      message:
        "Christine Samorin created an appointment for Christian Samorin on 5/12/2026, 8:00:00 AM.",
    };

    expect(resolveNotificationActionUrl(notification)).toBe(
      "/appointments?period=month&search=Christian+Samorin",
    );
  });

  test("maps low stock notifications to the inventory module", () => {
    const notification = {
      category: "low_stock",
      title: "Low stock warning",
      message: "MMR doses are running low.",
    };

    expect(resolveNotificationCategory(notification)).toBe("inventory_low_stock");
    expect(resolveNotificationActionUrl(notification)).toBe("/inventory");
  });

  test("maps expiry warnings to the inventory module", () => {
    const notification = {
      notification_type: "expiry_warning",
      title: "Vaccine expiring soon",
      message: "BCG batch expires within 30 days.",
    };

    expect(resolveNotificationCategory(notification)).toBe("inventory_low_stock");
    expect(resolveNotificationActionUrl(notification)).toBe("/inventory");
  });

  test("maps guardian registration notifications to the guardians tab in user management", () => {
    const notification = {
      title: "New Registration",
      message: "A new guardian has registered successfully.",
    };

    expect(resolveNotificationCategory(notification)).toBe("guardian_registration");
    expect(resolveNotificationActionUrl(notification)).toBe("/users?tab=guardians");
  });

  test("maps report notifications to the reports module", () => {
    const notification = {
      event_type: "report_generated",
      title: "Monthly report ready",
      message: "The vaccination report is ready for download.",
    };

    expect(resolveNotificationCategory(notification)).toBe("report");
    expect(resolveNotificationActionUrl(notification)).toBe("/reports");
  });

  test("maps guardian infant registration notifications to the child profile module", () => {
    const notification = {
      notification_type: "child_registration_success",
      title: "Child registered",
      message: "Your child was registered successfully.",
      infant_id: 42,
    };

    expect(resolveNotificationCategory(notification, { isGuardian: true })).toBe(
      "vaccination_update",
    );
    expect(
      resolveNotificationActionUrl(notification, { isGuardian: true }),
    ).toBe("/guardian/children/42");
  });

  test("maps guardian vaccination schedule notifications to the immunization chart module", () => {
    const notification = {
      notification_type: "vaccination_reminder",
      title: "Vaccination due",
      message: "A child has a vaccination due soon.",
      metadata: {
        payload: {
          infantId: 7,
        },
      },
    };

    expect(resolveNotificationCategory(notification, { isGuardian: true })).toBe(
      "reminder",
    );
    expect(
      resolveNotificationActionUrl(notification, { isGuardian: true }),
    ).toBe("/guardian/immunization-chart/7");
  });

  test("maps guardian appointment suggestions to the appointments module", () => {
    const notification = {
      notification_type: "appointment_suggested",
      title: "Suggested appointment available",
      message: "A suggested appointment is available.",
      metadata: {
        infant_id: 7,
      },
    };

    expect(resolveNotificationCategory(notification, { isGuardian: true })).toBe(
      "appointment",
    );
    expect(
      resolveNotificationActionUrl(notification, { isGuardian: true }),
    ).toBe("/guardian/appointments?childId=7");
  });

  test("maps guardian messages directly to the messages module", () => {
    const notification = {
      notification_type: "new_message",
      title: "New message",
      message: "You have a new message from the clinic.",
    };

    expect(
      resolveNotificationActionUrl(notification, { isGuardian: true }),
    ).toBe("/guardian/messages");
  });

  test("hides guardian-inappropriate internal inventory notifications from the guardian view", () => {
    const notification = {
      notification_type: "low_stock_alert",
      title: "Low stock warning",
      message: "MMR doses are running low.",
    };

    expect(isGuardianVisibleNotification(notification)).toBe(false);
  });

  test("keeps guardian-targeted announcements visible to guardians", () => {
    const notification = {
      notification_type: "system_announcement",
      target_role: "guardian",
      title: "Clinic advisory",
      message: "The clinic will open later tomorrow due to maintenance.",
    };

    expect(isGuardianVisibleNotification(notification)).toBe(true);
    expect(resolveNotificationCategory(notification, { isGuardian: true })).toBe(
      "general",
    );
    expect(
      resolveNotificationActionUrl(notification, { isGuardian: true }),
    ).toBe("/guardian/notifications");
  });

  test("maps failed outbound notifications to the failed delivery filter", () => {
    const notification = {
      notification_type: "sms_failed",
      title: "SMS failed",
      message: "SMS delivery failed for guardian +639171234567.",
    };

    expect(resolveNotificationCategory(notification)).toBe(
      "outbound_message_failed",
    );
    expect(resolveNotificationActionUrl(notification)).toBe(
      "/notifications?category=outbound_message_failed&status=failed",
    );
  });
});
