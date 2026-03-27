import React, { useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Package,
  ShieldAlert,
  Syringe,
  UserCheck,
  Users,
} from "lucide-react";
import { Card, Button, PageHeader, Alert } from "../UI";
import {
  SkeletonCard,
  SkeletonPageHeader,
  SkeletonTable,
} from "../UI/SkeletonLoader";
import {
  useAdminVaccinationMonitoring,
  useDashboardAppointments,
  useDashboardInfants,
  useDashboardStats,
  useVaccineInventory,
} from "../../hooks/useCachedData";
import { useSocket } from "../../contexts/SocketContext";

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Skeleton version of the dashboard metrics
const DashboardMetricsSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
    {[1, 2, 3, 4].map((i) => (
      <SkeletonCard key={i} className="h-32" />
    ))}
  </div>
);

// Skeleton version of the monitoring card
const MonitoringCardSkeleton = () => (
  <Card title="Admin Vaccination Monitoring" className="xl:col-span-2">
    <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-200 dark:border-gray-700 p-3"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
            <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  </Card>
);

// Skeleton version of the notifications panel
const NotificationsPanelSkeleton = () => (
  <Card title="Notifications Panel Behavior">
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2 animate-pulse" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse" />
      </div>
      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 p-3"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2 animate-pulse" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-1 animate-pulse" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
    </div>
  </Card>
);

// Full skeleton dashboard
const DashboardSkeleton = () => (
  <div className="space-y-6 p-6">
    <SkeletonPageHeader />
    <DashboardMetricsSkeleton />
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <MonitoringCardSkeleton />
      <NotificationsPanelSkeleton />
    </div>
    <SkeletonCard className="h-48" />
  </div>
);

export default function DashboardOverview() {
  const navigate = useNavigate();
  const { alerts: socketAlerts, notifications: socketNotifications, isConnected } = useSocket();

  const previousSocketCountsRef = useRef({ alerts: 0, notifications: 0 });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats();
  const { data: appointments, isLoading: appointmentsLoading, refetch: refetchAppointments } = useDashboardAppointments(10);
  const { data: infants, isLoading: infantsLoading, refetch: refetchInfants } = useDashboardInfants();
  const { data: inventory, isLoading: inventoryLoading, refetch: refetchInventory } = useVaccineInventory();
  const { data: monitoring, isLoading: monitoringLoading, refetch: refetchMonitoring } =
    useAdminVaccinationMonitoring(
      { limit: 25 },
      {
        refetchInterval: 60 * 1000,
      },
    );

  // Combined refetch function for all dashboard data
  const refreshAllDashboardData = useCallback(async () => {
    await Promise.all([
      refetchStats(),
      refetchAppointments(),
      refetchInfants(),
      refetchInventory(),
      refetchMonitoring(),
    ]);
  }, [refetchStats, refetchAppointments, refetchInfants, refetchInventory, refetchMonitoring]);

  // Refresh on socket events - comprehensive handling for all data types
  useEffect(() => {
    if (!isConnected) {
      previousSocketCountsRef.current = { alerts: 0, notifications: 0 };
      return;
    }

    const currentCounts = {
      alerts: socketAlerts.length,
      notifications: socketNotifications.length,
    };

    const previousCounts = previousSocketCountsRef.current;
    const hasNewSocketActivity =
      currentCounts.alerts > previousCounts.alerts ||
      currentCounts.notifications > previousCounts.notifications;

    previousSocketCountsRef.current = currentCounts;

    if (!hasNewSocketActivity) return;

    // Debounce refresh to avoid excessive calls
    const timeoutId = setTimeout(() => {
      void refreshAllDashboardData();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [isConnected, socketAlerts.length, socketNotifications.length, refreshAllDashboardData]);

  const loading =
    statsLoading ||
    appointmentsLoading ||
    infantsLoading ||
    monitoringLoading ||
    inventoryLoading;

  const monitoringSummary = monitoring?.summary || {};
  const monitoringRows = useMemo(
    () => (Array.isArray(monitoring?.data) ? monitoring.data : []),
    [monitoring?.data],
  );

  const priorityNotifications = useMemo(() => {
    return monitoringRows
      .filter((row) => ["overdue", "due_soon"].includes(row?.next_status))
      .slice(0, 8)
      .map((row) => ({
        id: row.infant_id,
        status: row.next_status,
        infantName: `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Infant",
        guardianName: row.guardian_name || "Guardian",
        nextDueDate: row.next_due_date,
        upcomingAppointmentsCount: row.upcoming_appointments_count || 0,
      }));
  }, [monitoringRows]);

  const criticalInventoryCount = useMemo(() => {
    const list = Array.isArray(inventory) ? inventory : [];
    return list.filter((row) => row?.is_critical_stock || row?.priority === "URGENT").length;
  }, [inventory]);

  const keyMetrics = [
    {
      label: "Vaccinations",
      value: stats?.vaccination?.total ?? stats?.vaccinations ?? 0,
      subtitle: `Completed: ${stats?.vaccination?.completed ?? stats?.completed_vaccinations ?? 0}`,
      icon: Syringe,
    },
    {
      label: "Inventory Items",
      value: stats?.inventory?.total_items ?? stats?.inventory_items ?? 0,
      subtitle: `Low Stock: ${stats?.inventory?.low_stock_items ?? stats?.low_stock_items ?? stats?.low_stock ?? 0}`,
      icon: Package,
    },
    {
      label: "Appointments",
      value: stats?.appointments_summary?.total ?? stats?.appointments ?? 0,
      subtitle: `Completed: ${stats?.appointments_summary?.completed ?? stats?.completed_appointments ?? 0}`,
      icon: CalendarClock,
    },
    {
      label: "No Shows",
      value: stats?.appointments_summary?.no_show ?? stats?.no_show_appointments ?? 0,
      subtitle: `Missed Follow-up Load: ${stats?.appointments_summary?.missed_follow_up_load ?? stats?.missed_follow_up_load ?? 0}`,
      icon: ShieldAlert,
    },
    {
      label: "Guardians",
      value: stats?.guardians_summary?.total ?? stats?.guardians ?? 0,
      subtitle: `Active: ${stats?.guardians_summary?.active ?? stats?.active_guardians ?? 0}`,
      icon: Users,
    },
    {
      label: "Infants",
      value: stats?.infants_summary?.total ?? stats?.infants ?? infants?.length ?? 0,
      subtitle: `Up to Date: ${stats?.infants_summary?.up_to_date ?? stats?.up_to_date_infants ?? 0}`,
      icon: UserCheck,
    },
    {
      label: "Overdue Next Dose",
      value: monitoringSummary.overdueInfants || 0,
      subtitle: "Vaccination monitoring",
      icon: AlertTriangle,
    },
    {
      label: "Critical Stock Items",
      value: criticalInventoryCount,
      subtitle: `Expired Lots: ${stats?.inventory?.expired_items ?? stats?.expired_items ?? stats?.expired_lots ?? 0}`,
      icon: AlertTriangle,
    },
  ];

  // Show skeleton loader while data is loading
  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Dashboard Overview"
        subtitle="Admin monitoring for vaccination status, upcoming doses, and live operational alerts"
        icon="📊"
      />

      {!loading && priorityNotifications.length > 0 && (
        <Alert variant="warning">
          <div className="flex items-center justify-between gap-3">
            <span>
              {priorityNotifications.length} infants require urgent attention ({monitoringSummary.overdueInfants || 0}{" "}
              overdue, {monitoringSummary.dueSoonInfants || 0} due soon).
            </span>
            <Button size="sm" variant="secondary" onClick={() => navigate("/notifications")}>
              Open Notifications
            </Button>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {keyMetrics.map((item) => (
          <Card key={item.label} title={<span className="font-bold">{item.label}</span>}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{item.value}</p>
                {item.subtitle ? (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {item.subtitle}
                  </p>
                ) : null}
              </div>
              <item.icon className="w-6 h-6 text-primary-600" />
            </div>
          </Card>
        ))}
      </div>

      {/* Three Column Layout - Monitoring, Notifications, and Appointments inline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Admin Vaccination Monitoring */}
        <Card title={<span className="font-bold">Admin Vaccination Monitoring</span>} className="lg:col-span-1">
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {monitoringRows.length === 0 ? (
              <p className="text-sm text-gray-500">No monitoring records available.</p>
            ) : (
              monitoringRows.slice(0, 8).map((row) => (
                <div
                  key={`${row.infant_id}-${row.next_due_date || "na"}`}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm">
                      {(row.first_name || "") + " " + (row.last_name || "")}
                    </p>
                    <span
                      className={`px-2 py-1 rounded-full text-[11px] font-semibold capitalize ${
                        row.next_status === "overdue"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : row.next_status === "due_soon"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      }`}
                    >
                      {String(row.next_status || "unknown").replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 space-y-1">
                    <p>Guardian: {row.guardian_name || "N/A"}</p>
                    <p>Next dose: {formatDate(row.next_due_date)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Notifications Panel */}
        <Card title={<span className="font-bold">Notifications Panel</span>}>
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Realtime Status</p>
              <p className="mt-1 font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4" />
                {isConnected ? "Live connected" : "Socket offline"}
              </p>
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {priorityNotifications.length === 0 ? (
                <p className="text-sm text-gray-500">No urgent notifications.</p>
              ) : (
                priorityNotifications.slice(0, 5).map((entry) => (
                  <button
                    type="button"
                    key={`notif-${entry.id}-${entry.status}`}
                    onClick={() => navigate("/notifications")}
                    className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <p className="text-sm font-semibold">{entry.infantName}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {entry.status === "overdue" ? "Overdue" : "Due soon"} • {entry.guardianName}
                    </p>
                  </button>
                ))
              )}
            </div>

            <Button
              variant="primary"
              className="w-full"
              onClick={() => navigate("/notifications")}
              aria-label="Go to Notifications"
            >
              Go to Notifications
            </Button>
          </div>
        </Card>

        {/* Upcoming Appointments */}
        <Card title={<span className="font-bold">Upcoming Appointments</span>}>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {appointmentsLoading ? (
              <SkeletonTable rows={5} columns={2} />
            ) : (appointments || []).length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming appointments.</p>
            ) : (
              (appointments || []).slice(0, 6).map((apt) => (
                <div
                  key={`apt-${apt.id || apt.infant_id || apt.patient_name || Math.random()}`}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 text-sm flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                      {apt.patient_name ||
                          apt.infantName ||
                          apt.infant_name ||
                          `${apt.first_name || ""} ${apt.last_name || ""}`.trim() ||
                          "Infant"}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      Guardian: {apt.guardian_name || apt.guardianName || "Guardian unavailable"}
                    </p>
                  </div>
                  <span className="text-gray-500 whitespace-nowrap">
                    {formatDate(apt.scheduled_date || apt.scheduledDate)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

    </div>
  );
}
