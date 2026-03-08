import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, CalendarClock, ShieldAlert, Syringe } from "lucide-react";
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

  const [localRefreshTick, setLocalRefreshTick] = useState(0);

  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: appointments, isLoading: appointmentsLoading } = useDashboardAppointments(10);
  const { data: infants, isLoading: infantsLoading } = useDashboardInfants();
  const { data: inventory, isLoading: inventoryLoading } = useVaccineInventory();
  const { data: monitoring, isLoading: monitoringLoading, refetch: refetchMonitoring } =
    useAdminVaccinationMonitoring(
      { limit: 25 },
      {
        refetchInterval: 60 * 1000,
      },
    );

  useEffect(() => {
    if (!isConnected) return;
    if (socketAlerts.length === 0 && socketNotifications.length === 0) return;

    setLocalRefreshTick((prev) => prev + 1);
    refetchMonitoring();
  }, [isConnected, socketAlerts.length, socketNotifications.length, refetchMonitoring]);

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
      label: "Registered Infants",
      value: stats?.infants || infants?.length || 0,
      icon: Syringe,
    },
    {
      label: "Overdue Next Dose",
      value: monitoringSummary.overdueInfants || 0,
      icon: ShieldAlert,
    },
    {
      label: "Due Soon (7 days)",
      value: monitoringSummary.dueSoonInfants || 0,
      icon: CalendarClock,
    },
    {
      label: "Critical Stock Items",
      value: criticalInventoryCount,
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
              <p className="text-3xl font-bold">{item.value}</p>
              <item.icon className="w-6 h-6 text-primary-600" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card title={<span className="font-bold">Admin Vaccination Monitoring</span>} className="xl:col-span-2">
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {monitoringRows.length === 0 ? (
              <p className="text-sm text-gray-500">No monitoring records available.</p>
            ) : (
              monitoringRows.slice(0, 15).map((row) => (
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
                    <p>
                      Completed/Pending doses: {row.completed_count || 0}/{row.pending_count || 0}
                    </p>
                    <p>Upcoming appointments: {row.upcoming_appointments_count || 0}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card title={<span className="font-bold">Notifications Panel Behavior</span>}>
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Realtime Status</p>
              <p className="mt-1 font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4" />
                {isConnected ? "Live socket connected" : "Socket offline (polling active)"}
              </p>
            </div>

            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {priorityNotifications.length === 0 ? (
                <p className="text-sm text-gray-500">No urgent notifications generated from monitoring.</p>
              ) : (
                priorityNotifications.map((entry) => (
                  <button
                    type="button"
                    key={`notif-${entry.id}-${entry.status}`}
                    onClick={() => navigate("/notifications")}
                    className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <p className="text-sm font-semibold">{entry.infantName}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {entry.status === "overdue" ? "Overdue next dose" : "Due soon next dose"} • {entry.guardianName}
                    </p>
                    <p className="text-xs text-gray-500">Next due: {formatDate(entry.nextDueDate)}</p>
                  </button>
                ))
              )}
            </div>

            <Button variant="primary" className="w-full" onClick={() => navigate("/notifications")}>
              Go to Notifications
            </Button>
          </div>
        </Card>
      </div>

      <Card title={<span className="font-bold">Upcoming Appointments</span>}>
        <div className="space-y-2">
          {(appointments || []).slice(0, 6).map((apt, index) => (
            <div
              key={`${apt.id || index}`}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 text-sm flex items-center justify-between gap-2"
            >
              <span className="truncate">{apt.patient_name || apt.infantName || apt.infant_name || "Infant"}</span>
              <span className="text-gray-500">{formatDate(apt.scheduled_date || apt.scheduledDate)}</span>
            </div>
          ))}
          {(appointments || []).length === 0 && (
            <p className="text-sm text-gray-500">No upcoming appointments.</p>
          )}
        </div>
      </Card>

      <p className="text-xs text-gray-500">Live refresh ticks: {localRefreshTick}</p>
    </div>
  );
}
