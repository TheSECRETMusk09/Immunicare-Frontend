import { getSelectedDateAppointmentsByStatus } from "../pages/Appointments";

describe("appointments calendar status grouping", () => {
  test("groups attended, scheduled, no show, and cancelled appointments from existing day data", () => {
    const groupedAppointments = getSelectedDateAppointmentsByStatus([
      {
        id: 1,
        guardian_name: "Isaac Domingo",
        status: "attended",
      },
      {
        id: 2,
        guardian_name: "Nadine Panganiban",
        status: "scheduled",
      },
      {
        id: 3,
        guardian_name: "Karen Mabini",
        status: "No Show",
      },
      {
        id: 4,
        guardian_name: "Janine Mercado",
        status: "cancelled",
      },
    ]);

    expect(groupedAppointments.attended).toHaveLength(1);
    expect(groupedAppointments.attended[0].guardian_name).toBe("Isaac Domingo");
    expect(groupedAppointments.scheduled).toHaveLength(1);
    expect(groupedAppointments.scheduled[0].guardian_name).toBe("Nadine Panganiban");
    expect(groupedAppointments.noShow).toHaveLength(1);
    expect(groupedAppointments.noShow[0].guardian_name).toBe("Karen Mabini");
    expect(groupedAppointments.cancelled).toHaveLength(1);
    expect(groupedAppointments.cancelled[0].guardian_name).toBe("Janine Mercado");
  });

  test("treats completed, confirmed, rescheduled, and no_show variants consistently", () => {
    const groupedAppointments = getSelectedDateAppointmentsByStatus([
      { id: 1, status: "completed" },
      { id: 2, status: "confirmed" },
      { id: 3, status: "rescheduled" },
      { id: 4, status: "no_show" },
      { id: 5, status: "noshow" },
    ]);

    expect(groupedAppointments.attended).toHaveLength(1);
    expect(groupedAppointments.scheduled).toHaveLength(2);
    expect(groupedAppointments.noShow).toHaveLength(2);
    expect(groupedAppointments.cancelled).toHaveLength(0);
  });
});
