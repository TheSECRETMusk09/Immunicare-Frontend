import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import apiClient from "../utils/api";
import {
  downloadWordDocument,
  PRINT_PAGE_PRESETS,
} from "../utils/printDocumentExport";
import InventoryManagement, {
  getInventoryReportPdfConfig,
} from "../components/InventoryManagement";

const mockPdfSave = jest.fn();
const mockPdfConfigs = [];

jest.mock("jspdf", () => {
  class MockJsPDF {
    constructor(config = {}) {
      this.config = config;
      mockPdfConfigs.push(config);
      this.internal = {
        pageSize: {
          getWidth: () => 356,
          getHeight: () => 216,
        },
      };
      this.lastAutoTable = { finalY: 48 };
    }

    setDrawColor = jest.fn();
    setLineWidth = jest.fn();
    rect = jest.fn();
    addImage = jest.fn();
    setFont = jest.fn();
    setFontSize = jest.fn();
    text = jest.fn();
    line = jest.fn();
    setTextColor = jest.fn();
    autoTable = jest.fn((options = {}) => {
      if (typeof options.startY === "number") {
        this.lastAutoTable = { finalY: options.startY + 24 };
      }
      return this;
    });
    save = mockPdfSave;
  }

  return {
    __esModule: true,
    default: MockJsPDF,
  };
});

jest.mock("jspdf-autotable", () => ({
  __esModule: true,
}));

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getFacilityInfo: jest.fn(),
    getVaccineInventory: jest.fn(),
    getVaccines: jest.fn(),
    createVaccineInventoryTransaction: jest.fn(),
  },
}));

jest.mock("../utils/printDocumentExport", () => {
  const actual = jest.requireActual("../utils/printDocumentExport");
  return {
    __esModule: true,
    ...actual,
    downloadWordDocument: jest.fn(),
  };
});

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 101, role_type: "SYSTEM_ADMIN", clinic_id: 7, facility_id: 7 },
  }),
}));

const renderInventoryRoute = (initialEntry = "/inventory?tab=inventory_sheet") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/inventory" element={<InventoryManagement />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Inventory Management print and export behavior", () => {
  const mockPrint = jest.fn();
  const inventoryRecords = [
    {
      id: 1,
      clinic_id: 7,
      vaccine_id: 1,
      vaccine_name: "BCG",
      beginning_balance: 10,
      received_during_period: 4,
      received_date: "2026-11-02",
      received_from: "DOH",
      lot_batch_number: "LOT-BCG-001",
      expiry_date: "2026-12-31",
      transferred_in: 0,
      transferred_out: 1,
      transferred_out_date: "2026-11-10",
      expired_wasted: 0,
      issuance: 5,
      issuance_date: "2026-11-14",
    },
    {
      id: 2,
      clinic_id: 7,
      vaccine_id: 2,
      vaccine_name: "MMR",
      beginning_balance: 2,
      received_during_period: 1,
      received_date: "2026-11-05",
      received_from: "LGU",
      lot_batch_number: "MMR-LGU-002",
      expiry_date: "2027-03-20",
      transferred_in: 0,
      transferred_out: 0,
      expired_wasted: 0,
      issuance: 1,
      issuance_date: "2026-11-19",
    },
  ];

  let originalPrint;

  const waitForInventoryModuleReady = async () => {
    await waitFor(() => {
      expect(apiClient.getFacilityInfo).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(apiClient.getVaccineInventory).toHaveBeenCalledWith({
        clinic_id: 7,
      });
    });
  };

  beforeAll(() => {
    originalPrint = window.print;
    Object.defineProperty(window, "print", {
      configurable: true,
      writable: true,
      value: mockPrint,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, "print", {
      configurable: true,
      writable: true,
      value: originalPrint,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
    downloadWordDocument.mockClear();
    mockPdfSave.mockClear();
    mockPdfConfigs.length = 0;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    });

    apiClient.getFacilityInfo.mockResolvedValue({
      name: "San Nicolas Health Center",
      address: "San Nicolas",
      province: "Metro Manila",
      city: "Pasig",
      barangay: "San Nicolas",
    });
    apiClient.getVaccineInventory.mockResolvedValue(inventoryRecords);
    apiClient.getVaccines.mockResolvedValue([]);
  });

  afterEach(() => {
    delete global.fetch;
  });

  test("shows a unified inventory report toolbar with shared print and export actions", async () => {
    renderInventoryRoute();

    await waitForInventoryModuleReady();

    expect(
      screen.getByLabelText(/report format/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /print report/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download pdf/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download word/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save inventory/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download inventory sheet pdf/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download doh\/lgu pdf/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download ris pdf/i }),
    ).toBeInTheDocument();
  });

  test("inventory sheet print action shows the restored inventory-sheet report and removes the print class after printing", async () => {
    renderInventoryRoute("/inventory?tab=inventory_sheet");

    await waitForInventoryModuleReady();

    jest.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: /print report/i }));

    expect(document.body).toHaveClass("printing-inventory");
    expect(
      document.getElementById("inventory-print-page-style"),
    ).toHaveTextContent("size: legal landscape");
    expect(
      screen.getByTestId("inventory-sheet-print-report"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("inventory-sheet-print-header")).toHaveTextContent(
      "EPI VACCINE AND OTHER LOGISTICS INVENTORY FORM",
    );
    expect(screen.getByTestId("inventory-sheet-print-header")).toHaveTextContent(
      "DEPARTMENT OF HEALTH (DOH)",
    );
    expect(screen.getByTestId("inventory-sheet-print-header")).toHaveTextContent(
      "Expanded Program on Immunization",
    );
    expect(screen.getByTestId("inventory-sheet-print-header")).toHaveTextContent(
      "Department of Health Procured",
    );
    expect(screen.getByTestId("inventory-sheet-print-header")).toHaveTextContent(
      "HEALTH CENTER:",
    );
    expect(screen.getByTestId("inventory-sheet-print-header")).toHaveTextContent(
      "SAN NICOLAS HC",
    );
    expect(screen.getByTestId("inventory-sheet-print-header")).toHaveTextContent(
      "Inventory of Vaccines and Other Logistics",
    );
    expect(screen.getByTestId("inventory-sheet-print-header")).toHaveTextContent(
      "Code",
    );
    expect(screen.getByTestId("inventory-sheet-print-month-year")).toHaveTextContent(
      "For the Month: JANUARY",
    );

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(mockPrint).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(document.body).not.toHaveClass("printing-inventory");
    expect(
      screen.queryByTestId("inventory-sheet-print-report"),
    ).not.toBeInTheDocument();

    jest.useRealTimers();
  });

  test("stock form print report follows the DOH/LGU header structure and maps DOH versus LGU values", async () => {
    renderInventoryRoute();

    await waitForInventoryModuleReady();

    fireEvent.change(document.getElementById("inventory-report-date-toolbar"), {
      target: { value: "2026-11-15" },
    });
    fireEvent.change(screen.getByLabelText(/report format/i), {
      target: { value: "doh-lgu-stock-form" },
    });

    jest.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: /print report/i }));

    const printReport = screen.getByTestId("inventory-print-report");
    const printHeader = within(printReport).getByTestId("inventory-print-header");
    const printMonthYear = within(printReport).getByTestId("inventory-print-month-year");
    const printTable = within(printReport).getByTestId("inventory-print-table");

    expect(printHeader).toHaveTextContent("Republic of the Philippines");
    expect(printHeader).toHaveTextContent(
      "METRO MANILA CENTER FOR HEALTH DEVELOPMENT",
    );
    expect(printHeader).toHaveTextContent(
      "HEALTH FACILITY MONTHLY VACCINE STOCK INVENTORY REPORT",
    );
    expect(printHeader).toHaveTextContent(
      "DOH and LGU Utilization / Stock Inventory Form",
    );
    expect(printHeader).toHaveTextContent("Facility: San Nicolas Health Center");
    expect(printHeader).toHaveTextContent("Address: San Nicolas, Pasig, Metro Manila");
    expect(printHeader).toHaveTextContent("LGU: Pasig");
    expect(printHeader).toHaveTextContent("Reporting Period: NOVEMBER 2026");
    expect(printReport).toHaveTextContent("Address: San Nicolas, Pasig, Metro Manila");
    expect(printMonthYear).toHaveTextContent("NOVEMBER 2026");

    expect(
      within(printTable).getByText(/NATIONAL IMMUNIZATION PROGRAM/i),
    ).toBeInTheDocument();
    expect(within(printTable).getAllByText(/Received/i).length).toBeGreaterThan(0);
    expect(within(printTable).getAllByText(/Transferred/i).length).toBeGreaterThan(0);
    expect(within(printTable).getAllByText(/^DOH$/i).length).toBeGreaterThan(0);
    expect(within(printTable).getAllByText(/^LGU$/i).length).toBeGreaterThan(0);

    const printBcgRow = within(printTable)
      .getAllByRole("row", { hidden: true })
      .find((row) => within(row).queryByText("BCG") !== null);
    const printBcgCellValues = within(printBcgRow)
      .getAllByRole("cell", { hidden: true })
      .map((cell) => cell.textContent.trim());

    expect(printBcgCellValues).toEqual([
      "1",
      "BCG",
      "10",
      "0",
      "4",
      "0",
      "1",
      "0",
      "LOT-BCG-001",
      "12/31/2026",
      "11/02/2026 / 11/10/2026",
      "5",
      "0",
      "5",
      "8",
      "0",
    ]);

    const printMmrRow = within(printTable)
      .getAllByRole("row", { hidden: true })
      .find(
        (row) =>
          within(row).queryByText("Measles, Mumps and Rubella (MMR)") !== null,
      );
    const printMmrCellValues = within(printMmrRow)
      .getAllByRole("cell", { hidden: true })
      .map((cell) => cell.textContent.trim());

    expect(printMmrCellValues).toEqual([
      "7",
      "Measles, Mumps and Rubella (MMR)",
      "0",
      "2",
      "0",
      "1",
      "0",
      "0",
      "MMR-LGU-002",
      "03/20/2027",
      "11/05/2026",
      "0",
      "1",
      "1",
      "0",
      "2",
    ]);

    expect(
      within(printTable).queryByTestId("inventory-print-total-row"),
    ).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(200);
    });
    jest.useRealTimers();
  });

  test("deduplicates overlapping facility address parts in printable report headers", async () => {
    apiClient.getFacilityInfo.mockResolvedValueOnce({
      name: "San Nicolas Health Center",
      address: "Barangay San Nicolas, Pasig City, NCR",
      province: "NCR",
      city: "Pasig City",
      barangay: "Barangay San Nicolas",
    });

    renderInventoryRoute();

    await waitForInventoryModuleReady();

    jest.useFakeTimers();
    fireEvent.change(screen.getByLabelText(/report format/i), {
      target: { value: "doh-lgu-stock-form" },
    });
    fireEvent.click(screen.getByRole("button", { name: /print report/i }));

    const printHeader = screen.getByTestId("inventory-print-header");

    expect(printHeader).toHaveTextContent(
      "Address: Barangay San Nicolas, Pasig City, NCR",
    );
    expect(printHeader.textContent).not.toContain(
      "Barangay San Nicolas, Pasig City, NCR, Barangay San Nicolas",
    );
    expect(printHeader.textContent).not.toContain(
      "Pasig City, NCR, Pasig City, NCR",
    );

    act(() => {
      jest.advanceTimersByTime(200);
    });
    jest.useRealTimers();
  });

  test("ris print action renders the requisition and issue slip with seals and mapped inventory values", async () => {
    renderInventoryRoute();

    await waitForInventoryModuleReady();

    fireEvent.change(document.getElementById("inventory-report-date-toolbar"), {
      target: { value: "2026-11-15" },
    });
    fireEvent.change(screen.getByLabelText(/report format/i), {
      target: { value: "requisition-issue-slip" },
    });

    jest.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: /print report/i }));

    expect(
      document.getElementById("inventory-print-page-style"),
    ).toHaveTextContent("size: legal portrait");

    const printReport = screen.getByTestId("inventory-ris-print-report");
    const printHeader = within(printReport).getByTestId("inventory-ris-print-header");
    const printTable = within(printReport).getByTestId("inventory-ris-print-table");
    const printPeriod = within(printReport).getByTestId("inventory-ris-print-period");

    expect(printHeader).toHaveTextContent("REQUISITION AND ISSUE SLIP");
    expect(printHeader).toHaveTextContent("(VACCINES AND SUPPLIES)");
    expect(printHeader).toHaveTextContent("MUNICIPALITY OF PASIG");
    expect(printHeader).toHaveTextContent("Health Center:");
    expect(printHeader).toHaveTextContent("San Nicolas Health Center");
    expect(printHeader).toHaveTextContent("Private Clinic:");
    expect(printHeader).toHaveTextContent("(leave blank)");
    expect(printHeader).toHaveTextContent("Control Number:");
    expect(printHeader).toHaveTextContent("Year:");
    expect(printHeader).toHaveTextContent("2026");
    expect(printHeader).toHaveTextContent("Date:");
    expect(printHeader).toHaveTextContent("11/15/2026");
    expect(printHeader).toHaveTextContent("Address:");
    expect(printHeader).toHaveTextContent("San Nicolas, Pasig, Metro Manila");
    expect(printPeriod).toHaveTextContent("NOVEMBER 2026");

    expect(
      within(printHeader).getByAltText(/municipality of pasig seal/i),
    ).toBeInTheDocument();
    expect(
      within(printHeader).getByAltText(/department of health seal/i),
    ).toBeInTheDocument();

    const bcgRow = within(printTable)
      .getAllByRole("row", { hidden: true })
      .find((row) => within(row).queryByText(/BCG, 20 DOSES/i) !== null);
    const bcgValues = within(bcgRow)
      .getAllByRole("cell", { hidden: true })
      .map((cell) => cell.textContent.trim());

    expect(bcgValues).toEqual(["BCG, 20 DOSES", "VIAL", "10", "4", "4", "14"]);

    const mmrRow = within(printTable)
      .getAllByRole("row", { hidden: true })
      .find((row) => within(row).queryByText(/MMR 0.5ml dose \/ 10 doses/i) !== null);
    const mmrValues = within(mmrRow)
      .getAllByRole("cell", { hidden: true })
      .map((cell) => cell.textContent.trim());

    expect(mmrValues).toEqual([
      "MMR 0.5ml dose / 10 doses",
      "VIAL",
      "2",
      "1",
      "1",
      "3",
    ]);

    act(() => {
      jest.advanceTimersByTime(200);
    });
    jest.useRealTimers();
  });

  test("locks RIS Word export to legal portrait without changing other inventory report templates", async () => {
    renderInventoryRoute();

    await waitForInventoryModuleReady();

    fireEvent.change(screen.getByLabelText(/report format/i), {
      target: { value: "requisition-issue-slip" },
    });

    fireEvent.click(screen.getByRole("button", { name: /download word/i }));

    expect(downloadWordDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "REQUISITION AND ISSUE SLIP",
        page: PRINT_PAGE_PRESETS.legalPortrait,
      }),
    );

    fireEvent.change(screen.getByLabelText(/report format/i), {
      target: { value: "inventory-sheet" },
    });

    fireEvent.click(screen.getByRole("button", { name: /download word/i }));

    expect(downloadWordDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "EPI VACCINE AND OTHER LOGISTICS INVENTORY FORM",
        page: PRINT_PAGE_PRESETS.legalLandscape,
      }),
    );
  });

  test("locks RIS PDF export to legal portrait without changing other inventory report templates", async () => {
    expect(getInventoryReportPdfConfig("requisition-issue-slip")).toEqual({
      orientation: "portrait",
      format: "legal",
    });

    expect(getInventoryReportPdfConfig("inventory-sheet")).toEqual({
      orientation: "landscape",
      format: "legal",
    });
  });

  test("toolbar PDF download follows the selected report format for DOH/LGU and RIS forms", async () => {
    renderInventoryRoute();

    await waitForInventoryModuleReady();

    fireEvent.change(screen.getByLabelText(/report format/i), {
      target: { value: "doh-lgu-stock-form" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^download pdf$/i }));

    await waitFor(() => {
      expect(mockPdfSave).toHaveBeenCalledWith(
        expect.stringMatching(/^doh-lgu-stock-inventory-report-/i),
      );
    });
    expect(mockPdfConfigs.at(-1)).toEqual(
      expect.objectContaining({ orientation: "landscape", format: "legal" }),
    );

    fireEvent.change(screen.getByLabelText(/report format/i), {
      target: { value: "requisition-issue-slip" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^download pdf$/i }));

    await waitFor(() => {
      expect(mockPdfSave).toHaveBeenCalledWith(
        expect.stringMatching(/^requisition-and-issue-slip-/i),
      );
    });
    expect(mockPdfConfigs.at(-1)).toEqual(
      expect.objectContaining({ orientation: "portrait", format: "legal" }),
    );
  });
});
