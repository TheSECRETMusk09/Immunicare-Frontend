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
  downloadPdfFromHtml,
  PRINT_PAGE_PRESETS,
} from "../utils/printDocumentExport";
import InventoryManagement, {
  getInventoryReportPdfConfig,
} from "../components/InventoryManagement";

const mockPdfSave = jest.fn();
const mockPdfConfigs = [];
const mockPdfInstances = [];

jest.mock("jspdf", () => {
  class MockJsPDF {
    constructor(config = {}) {
      this.config = config;
      mockPdfConfigs.push(config);
      mockPdfInstances.push(this);
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
    addPage = jest.fn(() => this);
    setFont = jest.fn();
    setFontSize = jest.fn();
    text = jest.fn();
    line = jest.fn();
    setTextColor = jest.fn();
    autoTable = jest.fn((options = {}) => {
      this.autoTableOptions = options;
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
    downloadPdfFromHtml: jest.fn(),
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

const openGenerateReportModal = async () => {
  fireEvent.click(screen.getByRole("button", { name: /^generate report$/i }));
  return screen.findByRole("dialog", { name: /generate report/i });
};

const generateReportFromModal = async ({
  reportType = "inventory-sheet",
  format = "print",
  reportDate = "2026-11-15",
} = {}) => {
  const modal = await openGenerateReportModal();

  fireEvent.change(within(modal).getByLabelText(/report type/i), {
    target: { value: reportType },
  });
  fireEvent.change(within(modal).getByLabelText(/^format/i), {
    target: { value: format },
  });
  fireEvent.change(within(modal).getByLabelText(/report date/i), {
    target: { value: reportDate },
  });

  fireEvent.click(within(modal).getByRole("button", { name: /generate report/i }));
};

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
    downloadPdfFromHtml.mockClear();
    mockPdfSave.mockClear();
    mockPdfConfigs.length = 0;
    mockPdfInstances.length = 0;
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
      screen.getByRole("button", { name: /save inventory/i }),
    ).toBeInTheDocument();

    const modal = await openGenerateReportModal();
    expect(within(modal).getByLabelText(/report type/i)).toBeInTheDocument();
    expect(within(modal).getByLabelText(/^format/i)).toBeInTheDocument();
    expect(
      within(modal).getByRole("option", { name: /print preview/i }),
    ).toBeInTheDocument();
    expect(
      within(modal).getByRole("option", { name: /pdf document/i }),
    ).toBeInTheDocument();
    expect(
      within(modal).queryByRole("option", { name: /word document/i }),
    ).not.toBeInTheDocument();

    fireEvent.change(within(modal).getByLabelText(/report type/i), {
      target: { value: "doh-lgu-stock-form" },
    });

    expect(
      within(modal).queryByRole("option", { name: /word document/i }),
    ).not.toBeInTheDocument();
    expect(within(modal).getByLabelText(/^format/i)).toHaveValue("print");

    fireEvent.change(within(modal).getByLabelText(/report type/i), {
      target: { value: "requisition-issue-slip" },
    });

    expect(
      within(modal).queryByRole("option", { name: /word document/i }),
    ).not.toBeInTheDocument();
  });

  test("inventory sheet print action shows the restored inventory-sheet report and removes the print class after printing", async () => {
    renderInventoryRoute("/inventory?tab=inventory_sheet");

    await waitForInventoryModuleReady();
    fireEvent.change(document.getElementById("inventory-report-date"), {
      target: { value: "2026-11-15" },
    });

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
      "Republic of the Philippines",
    );
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
      "San Nicolas Health Center",
    );
    expect(screen.getByTestId("inventory-sheet-print-header")).toHaveTextContent(
      /inventory of vaccines and other logistics?/i,
    );
    expect(
      within(screen.getByTestId("inventory-sheet-print-header")).getByAltText(
        /department of health logo/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("inventory-sheet-print-header")).getByAltText(
        /san nicolas health center logo/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("inventory-sheet-print-header")).toHaveTextContent(
      "Code",
    );
    expect(screen.getByTestId("inventory-sheet-print-month-year")).toHaveTextContent(
      "FOR THE MONTH: NOVEMBER 2026",
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

  test("inventory sheet keeps the latest row actionable while showing historical totals across saved periods", async () => {
    apiClient.getVaccineInventory.mockResolvedValueOnce([
      {
        id: 10,
        clinic_id: 7,
        vaccine_id: 1,
        vaccine_name: "BCG",
        beginning_balance: 1000,
        received_during_period: 500,
        lot_batch_number: "LOT-BCG-OLD",
        transferred_in: 25,
        transferred_out: 10,
        expired_wasted: 4,
        issuance: 300,
        stock_on_hand: 1211,
        period_start: "2025-11-01",
        period_end: "2025-11-30",
        updated_at: "2025-11-30T08:00:00.000Z",
      },
      {
        id: 11,
        clinic_id: 7,
        vaccine_id: 1,
        vaccine_name: "BCG",
        beginning_balance: 10,
        received_during_period: 4,
        lot_batch_number: "LOT-BCG-NEW",
        transferred_in: 0,
        transferred_out: 1,
        expired_wasted: 0,
        issuance: 5,
        stock_on_hand: 8,
        period_start: "2026-11-01",
        period_end: "2026-11-30",
        updated_at: "2026-11-30T08:00:00.000Z",
      },
      inventoryRecords[1],
    ]);

    renderInventoryRoute("/inventory?tab=inventory_sheet");

    await waitForInventoryModuleReady();

    const inventoryPanel = screen.getByTestId("inventory-sheet-panel");
    const inventoryRows = within(inventoryPanel).getAllByRole("row");
    const bcgRow = inventoryRows.find((row) => within(row).queryByText("BCG"));
    expect(bcgRow).toBeDefined();

    const bcgCells = within(bcgRow).getAllByRole("cell", { hidden: true });
    expect(bcgCells[2]).toHaveTextContent("1000");
    expect(bcgCells[3]).toHaveTextContent("504");
    expect(bcgCells[4]).toHaveTextContent("MULTIPLE LOTS (2)");
    expect(bcgCells[5]).toHaveTextContent("25");
    expect(bcgCells[5]).toHaveTextContent("11");
    expect(bcgCells[6]).toHaveTextContent("4");
    expect(bcgCells[7]).toHaveTextContent("1504");
    expect(bcgCells[8]).toHaveTextContent("305");
    expect(bcgCells[9]).toHaveTextContent("8");
    expect(
      within(bcgRow).getByRole("button", { name: /receive/i }),
    ).toBeInTheDocument();
    expect(bcgRow).not.toHaveTextContent("LOT-BCG-NEW");

    const totalRow = inventoryRows.find((row) => within(row).queryByText(/^TOTAL$/));
    expect(totalRow).toBeDefined();

    const totalCells = within(totalRow).getAllByRole("cell", { hidden: true });
    expect(totalCells[1]).toHaveTextContent("1002");
    expect(totalCells[2]).toHaveTextContent("505");
    expect(totalCells[6]).toHaveTextContent("1507");
    expect(totalCells[7]).toHaveTextContent("306");
    expect(totalCells[8]).toHaveTextContent("10");
    expect(totalRow).not.toHaveTextContent("1517");
  });

  test("stock form print report uses the dedicated DOH/LGU stock form layout and preserves the report month", async () => {
    renderInventoryRoute();

    await waitForInventoryModuleReady();

    fireEvent.change(document.getElementById("inventory-report-date"), {
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

    expect(
      document.getElementById("inventory-print-page-style"),
    ).toHaveTextContent("size: legal landscape");

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
    expect(printHeader).toHaveTextContent("Facility:");
    expect(printHeader).toHaveTextContent("SAN NICOLAS HEALTH CENTER");
    expect(printHeader).toHaveTextContent("LGU:");
    expect(printHeader).toHaveTextContent("PASIG CITY");
    expect(printHeader).toHaveTextContent("Address:");
    expect(printHeader).toHaveTextContent("SAN NICOLAS, PASIG, METRO MANILA");
    expect(printMonthYear).toHaveTextContent("Reporting Period: NOVEMBER 2026");
    expect(printHeader).not.toHaveTextContent("Health Facility:");
    expect(printHeader).not.toHaveTextContent("Year:");
    expect(printHeader).not.toHaveTextContent("Date:");
    expect(printHeader).not.toHaveTextContent("For the Month:");

    expect(
      within(printHeader).getByAltText(/department of health seal/i),
    ).toBeInTheDocument();
    expect(
      within(printHeader).getByAltText(/municipality of pasig seal/i),
    ).toBeInTheDocument();
    expect(
      within(printTable).getByText(/national immunization program \(nip\)/i),
    ).toBeInTheDocument();
    expect(
      within(printTable).getByText(/ending inventory from the previous month/i),
    ).toBeInTheDocument();
    expect(
      within(printTable).getByText(/stock transfer \(dm 2014-0317\)/i),
    ).toBeInTheDocument();
    expect(
      within(printTable).getByText(/monthly consumption \(d\)/i),
    ).toBeInTheDocument();
    expect(
      within(printTable).getByText(
        /number of patients received the vaccine for this month/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(printTable).getByText(/end of month stocks \(a\+b\) - \(c\+d\)/i),
    ).toBeInTheDocument();
    expect(within(printTable).queryByText(/^Items$/i)).not.toBeInTheDocument();

    const printBcgRow = within(printTable)
      .getAllByRole("row", { hidden: true })
      .find((row) => within(row).queryByText("BCG") !== null);
    expect(printBcgRow).toBeDefined();
    const printBcgCells = within(printBcgRow).getAllByRole("cell", {
      hidden: true,
    });

    expect(printBcgCells[0]).toHaveTextContent("1");
    expect(printBcgCells[1]).toHaveTextContent("BCG");
    expect(printBcgCells[2]).toHaveTextContent("10");
    expect(printBcgCells[3]).toHaveTextContent("0");
    expect(printBcgCells[4]).toHaveTextContent("4");
    expect(printBcgCells[5]).toHaveTextContent("0");
    expect(printBcgCells[6]).toHaveTextContent("1");
    expect(printBcgCells[7]).toHaveTextContent("0");
    expect(printBcgCells[8]).toHaveTextContent("LOT-BCG-001");
    expect(printBcgCells[9]).toHaveTextContent("12/31/2026");
    expect(printBcgCells[10]).toHaveTextContent("11/02/2026");
    expect(printBcgCells[10]).toHaveTextContent("11/10/2026");
    expect(printBcgCells[11]).toHaveTextContent("5");
    expect(printBcgCells[12]).toHaveTextContent("0");
    expect(printBcgCells[13]).toHaveTextContent("5");
    expect(printBcgCells[14]).toHaveTextContent("0");
    expect(printBcgCells[15]).toHaveTextContent("8");
    expect(printBcgCells[16]).toHaveTextContent("0");

    const printMmrRow = within(printTable)
      .getAllByRole("row", { hidden: true })
      .find(
        (row) =>
          within(row).queryByText(/measles, mumps and rubella \(mmr\)/i) !== null,
      );
    expect(printMmrRow).toBeDefined();
    const printMmrCells = within(printMmrRow).getAllByRole("cell", {
      hidden: true,
    });

    expect(printMmrCells[0]).toHaveTextContent("7");
    expect(printMmrCells[1]).toHaveTextContent(/measles, mumps and rubella \(mmr\)/i);
    expect(printMmrCells[2]).toHaveTextContent("0");
    expect(printMmrCells[3]).toHaveTextContent("2");
    expect(printMmrCells[4]).toHaveTextContent("0");
    expect(printMmrCells[5]).toHaveTextContent("1");
    expect(printMmrCells[6]).toHaveTextContent("0");
    expect(printMmrCells[7]).toHaveTextContent("0");
    expect(printMmrCells[8]).toHaveTextContent("MMR-LGU-002");
    expect(printMmrCells[9]).toHaveTextContent("03/20/2027");
    expect(printMmrCells[10]).toHaveTextContent("11/05/2026");
    expect(printMmrCells[11]).toHaveTextContent("0");
    expect(printMmrCells[12]).toHaveTextContent("1");
    expect(printMmrCells[13]).toHaveTextContent("0");
    expect(printMmrCells[14]).toHaveTextContent("1");
    expect(printMmrCells[15]).toHaveTextContent("0");
    expect(printMmrCells[16]).toHaveTextContent("2");

    act(() => {
      jest.advanceTimersByTime(200);
    });
    jest.useRealTimers();
  });

  test("deduplicates overlapping facility address parts in RIS printable report headers", async () => {
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
      target: { value: "requisition-issue-slip" },
    });
    fireEvent.click(screen.getByRole("button", { name: /print report/i }));

    const printHeader = screen.getByTestId("inventory-ris-print-header");

    expect(printHeader).toHaveTextContent("Address:");
    expect(printHeader).toHaveTextContent(
      "Barangay San Nicolas, Pasig City, NCR",
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

    fireEvent.change(document.getElementById("inventory-report-date"), {
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

  test("keeps the generate report modal on print/pdf only for inventory sheet and RIS form", async () => {
    renderInventoryRoute();

    await waitForInventoryModuleReady();

    const modal = await openGenerateReportModal();

    expect(within(modal).getByLabelText(/^format/i)).toHaveValue("print");
    expect(
      within(modal).queryByRole("option", { name: /word document/i }),
    ).not.toBeInTheDocument();

    fireEvent.change(within(modal).getByLabelText(/report type/i), {
      target: { value: "requisition-issue-slip" },
    });

    expect(within(modal).getByLabelText(/^format/i)).toHaveValue("print");
    expect(
      within(modal).queryByRole("option", { name: /word document/i }),
    ).not.toBeInTheDocument();

    fireEvent.change(within(modal).getByLabelText(/report type/i), {
      target: { value: "inventory-sheet" },
    });

    expect(within(modal).getByLabelText(/^format/i)).toHaveValue("print");
    expect(
      within(modal).queryByRole("option", { name: /word document/i }),
    ).not.toBeInTheDocument();
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

    await generateReportFromModal({
      reportType: "doh-lgu-stock-form",
      format: "pdf",
    });

    await waitFor(() => {
      expect(mockPdfSave).toHaveBeenCalledWith(
        expect.stringMatching(/^doh-lgu-stock-inventory-report-/i),
      );
    });
    expect(mockPdfConfigs.at(-1)).toEqual(
      expect.objectContaining({ orientation: "landscape", format: "legal" }),
    );
    expect(mockPdfInstances.at(-1).autoTableOptions.didDrawPage).toBeUndefined();

    await generateReportFromModal({
      reportType: "requisition-issue-slip",
      format: "pdf",
    });

    await waitFor(() => {
      expect(mockPdfSave).toHaveBeenCalledWith(
        expect.stringMatching(/^requisition-and-issue-slip-/i),
      );
    });
    expect(mockPdfConfigs.at(-1)).toEqual(
      expect.objectContaining({ orientation: "portrait", format: "legal" }),
    );
  });

  test("doh lgu pdf export keeps the requested report month label for april 2026", async () => {
    renderInventoryRoute();

    await waitForInventoryModuleReady();

    await generateReportFromModal({
      reportType: "doh-lgu-stock-form",
      format: "pdf",
      reportDate: "2026-04-08",
    });

    await waitFor(() => {
      expect(mockPdfSave).toHaveBeenCalledWith(
        expect.stringMatching(/^doh-lgu-stock-inventory-report-/i),
      );
    });
    expect(
      mockPdfInstances.at(-1).text.mock.calls.some((call) =>
        String(call[0]).includes("APRIL 2026"),
      ),
    ).toBe(true);
  });

  test("ris print preview keeps the requested reporting period label for april 2026", async () => {
    renderInventoryRoute();

    await waitForInventoryModuleReady();

    fireEvent.change(document.getElementById("inventory-report-date"), {
      target: { value: "2026-04-08" },
    });
    fireEvent.change(screen.getByLabelText(/report format/i), {
      target: { value: "requisition-issue-slip" },
    });

    jest.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: /print report/i }));

    expect(
      screen.getByTestId("inventory-ris-print-period"),
    ).toHaveTextContent("APRIL 2026");

    act(() => {
      jest.advanceTimersByTime(200);
    });
    jest.useRealTimers();
  });

  test("inventory sheet PDF download stays legal landscape and uses the inventory-sheet filename", async () => {
    renderInventoryRoute();

    await waitForInventoryModuleReady();

    await generateReportFromModal({
      reportType: "inventory-sheet",
      format: "pdf",
    });

    await waitFor(() => {
      expect(mockPdfSave).toHaveBeenCalledWith(
        expect.stringMatching(/^inventory-sheet-/i),
      );
    });

    expect(mockPdfConfigs.at(-1)).toEqual(
      expect.objectContaining({ orientation: "landscape", format: "legal" }),
    );
  });
});
