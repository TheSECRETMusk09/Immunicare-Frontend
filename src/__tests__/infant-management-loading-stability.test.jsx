import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import InfantPersonalRecord from "../components/InfantPersonalRecord";
import VaccineScheduleBooklet from "../components/VaccineScheduleBooklet";
import ImmunizationRecordBooklet from "../components/ImmunizationRecordBooklet";
import ImmunizationChart from "../components/ImmunizationChart";
import apiClient from "../utils/api";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    request: jest.fn(),
    customRequest: jest.fn(),
    getInfant: jest.fn(),
    updateInfant: jest.fn(),
    getDynamicSchedule: jest.fn(),
    getVaccinationSchedules: jest.fn(),
    getVaccinationRecordsByInfant: jest.fn(),
    getAppointmentsByInfant: jest.fn(),
    getGrowthRecordsByInfant: jest.fn(),
    recordVaccinationWithInventory: jest.fn(),
    getVaccines: jest.fn(),
    getVaccineBatches: jest.fn(),
    createGrowthRecord: jest.fn(),
    createVaccinationRecord: jest.fn(),
  },
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    isAdmin: true,
    isGuardian: false,
  }),
}));

const baseInfant = {
  id: 1,
  first_name: "Baby",
  last_name: "One",
  middle_name: "A",
  dob: "2025-01-01",
  sex: "F",
  control_number: "001",
  mother_name: "Mother One",
  father_name: "Father One",
  address: "San Nicolas",
  barangay: "San Nicolas",
  health_center: "Barangay San Nicolas Health Center",
  purok: "Purok 7",
  street_color: "Bedana / Dimanlig St. - Red",
};

const baseSchedule = [
  {
    id: 11,
    vaccine_id: 10,
    vaccine_name: "BCG",
    disease_prevented: "Tuberculosis",
    age_in_months: 0,
    dose_number: 1,
    is_active: true,
  },
];

const baseDynamicSchedule = {
  infantInfo: {
    firstName: "Baby",
    lastName: "One",
    controlNumber: "001",
    dateOfBirth: "2025-01-01",
    guardianName: "Mother One",
  },
  summary: {
    totalScheduled: 1,
    completedCount: 0,
    overdueCount: 0,
    upcomingCount: 1,
  },
  schedules: [
    {
      vaccineId: 1,
      vaccineName: "BCG",
      ageMonths: 0,
      ageDescription: "At Birth",
      doseNumber: 1,
      totalDoses: 1,
      status: "upcoming",
      dueDate: "2025-01-01",
      adminDate: null,
      daysOverdue: 0,
      isOverdue: false,
      isUpcoming: true,
    },
  ],
};

const renderStrict = (ui) => render(<React.StrictMode>{ui}</React.StrictMode>);

const readBlobAsText = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(blob);
  });

describe("Infant module loading stability under StrictMode lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();

    apiClient.getInfant.mockResolvedValue(baseInfant);
    apiClient.updateInfant.mockResolvedValue(baseInfant);
    apiClient.request.mockResolvedValue({ success: true, data: [] });
    apiClient.customRequest.mockResolvedValue({ data: [] });
    apiClient.getDynamicSchedule.mockResolvedValue(baseDynamicSchedule);
    apiClient.getVaccinationSchedules.mockResolvedValue(baseSchedule);
    apiClient.getVaccinationRecordsByInfant.mockResolvedValue([]);
    apiClient.getAppointmentsByInfant.mockResolvedValue([]);
    apiClient.getGrowthRecordsByInfant.mockResolvedValue([]);
    apiClient.getVaccines.mockResolvedValue([]);
    apiClient.getVaccineBatches.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  test("InfantPersonalRecord exits loading state after StrictMode effect replay", async () => {
    renderStrict(<InfantPersonalRecord infantId={1} />);

    expect(screen.getByText(/loading infant record/i)).toBeInTheDocument();

    await screen.findByText(/infant personal information record/i);

    expect(screen.queryByText(/loading infant record/i)).not.toBeInTheDocument();
    expect(apiClient.getInfant).toHaveBeenCalled();
  });

  test("InfantPersonalRecord renders saved purok details in health center information", async () => {
    renderStrict(<InfantPersonalRecord infantId={1} />);

    await screen.findByText(/health center information/i);

    expect(screen.getByText("Purok 7")).toBeInTheDocument();
    expect(
      screen.getByText("Bedana / Dimanlig St. - Red"),
    ).toBeInTheDocument();
  });

  test("VaccineScheduleBooklet exits loading state after StrictMode effect replay", async () => {
    renderStrict(<VaccineScheduleBooklet infantId={1} />);

    expect(screen.getByText(/loading vaccine schedule/i)).toBeInTheDocument();

    const scheduleHeadings = await screen.findAllByText(
      /child immunization schedule booklet/i,
    );
    expect(scheduleHeadings.length).toBeGreaterThanOrEqual(1);

    expect(screen.queryByText(/loading vaccine schedule/i)).not.toBeInTheDocument();
    expect(apiClient.getDynamicSchedule).toHaveBeenCalledWith(1);
  });

  test("ImmunizationRecordBooklet exits loading state after StrictMode effect replay", async () => {
    renderStrict(<ImmunizationRecordBooklet infantId={1} />);

    expect(screen.getByText(/loading immunization records/i)).toBeInTheDocument();

    const recordHeadings = await screen.findAllByText(
      /child immunization record booklet/i,
    );
    expect(recordHeadings.length).toBeGreaterThanOrEqual(1);

    expect(
      screen.queryByText(/loading immunization records/i),
    ).not.toBeInTheDocument();
    expect(apiClient.getVaccinationRecordsByInfant).toHaveBeenCalled();
  });

  test("ImmunizationChart exits loading state after StrictMode effect replay", async () => {
    renderStrict(<ImmunizationChart infantId={1} />);

    expect(screen.getByText(/loading immunization chart/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/detailed visit records for/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/loading immunization chart/i)).not.toBeInTheDocument();
    expect(apiClient.getAppointmentsByInfant).toHaveBeenCalled();
    expect(apiClient.getGrowthRecordsByInfant).toHaveBeenCalled();
  });

  test("ImmunizationChart renders PDF action with the redesigned visit layout", async () => {
    apiClient.getInfant.mockResolvedValue({
      ...baseInfant,
      birth_weight: 3.1,
      birth_height: 49,
      place_of_birth: "Pasig City",
      mother_name: "Mother One",
      cellphone_number: "09123456789",
      time_of_delivery: "08:30",
      type_of_delivery: "NSD",
      doctor_midwife_nurse: "Nurse",
      nbs_done: true,
      nbs_date: "2025-01-02",
    });
    apiClient.getVaccinationRecordsByInfant.mockResolvedValue([
      {
        id: 1,
        vaccine_name: "BCG",
        dose_no: 1,
        admin_date: "2025-01-01",
        status: "completed",
      },
      {
        id: 2,
        vaccine_name: "Hepa B",
        dose_no: 1,
        admin_date: "2025-01-01",
        status: "completed",
      },
    ]);

    renderStrict(<ImmunizationChart infantId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/detailed visit records for/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /print \/ pdf/i })).toBeInTheDocument();
    expect(screen.getByText(/^6 weeks$/i)).toBeInTheDocument();
    expect(screen.getByText(/^10 weeks$/i)).toBeInTheDocument();
    expect(screen.getByText(/^14 weeks$/i)).toBeInTheDocument();
    expect(screen.getByText(/^6 months$/i)).toBeInTheDocument();
    expect(screen.getByText(/^9 months$/i)).toBeInTheDocument();
    expect(screen.getByText(/^12 months$/i)).toBeInTheDocument();
    expect(screen.getByText(/mother one/i)).toBeInTheDocument();
  });

  test("ImmunizationChart prints through a prepared iframe document instead of a blank popup", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
    const originalCreateElement = document.createElement.bind(document);
    const frameEvents = new Map();
    const writtenHtml = [];
    const frameFocus = jest.fn();
    const framePrint = jest.fn(() => {
      const afterPrintHandler = frameEvents.get("afterprint");
      if (typeof afterPrintHandler === "function") {
        afterPrintHandler();
      }
    });

    Object.defineProperty(window.HTMLImageElement.prototype, "complete", {
      configurable: true,
      get: () => true,
    });

    global.fetch = jest.fn().mockRejectedValue(new Error("asset load unavailable in test"));

    const createElementSpy = jest
      .spyOn(document, "createElement")
      .mockImplementation((tagName, options) => {
        if (String(tagName).toLowerCase() === "iframe") {
          const iframe = originalCreateElement("iframe", options);
          const iframeDocument = document.implementation.createHTMLDocument("print-frame");
          const originalWrite = iframeDocument.write.bind(iframeDocument);

          iframeDocument.write = jest.fn((html) => {
            writtenHtml.push(html);
            originalWrite(html);
          });

          Object.defineProperty(iframe, "contentWindow", {
            configurable: true,
            value: {
              document: iframeDocument,
              focus: frameFocus,
              print: framePrint,
              addEventListener: jest.fn((eventName, handler) => {
                frameEvents.set(eventName, handler);
              }),
            },
          });

          return iframe;
        }

        return originalCreateElement(tagName, options);
      });

    renderStrict(<ImmunizationChart infantId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/detailed visit records for/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /print \/ pdf/i }));

    await waitFor(() => {
      expect(framePrint).toHaveBeenCalledTimes(1);
    });

    expect(frameFocus).toHaveBeenCalledTimes(1);
    expect(openSpy).not.toHaveBeenCalled();
    expect(writtenHtml[0]).toContain("IMMUNIZATION CHART");
    expect(writtenHtml[0]).toContain("6 WEEKS");
    expect(writtenHtml[0]).toContain("CATCH UP:");

    createElementSpy.mockRestore();
    openSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
