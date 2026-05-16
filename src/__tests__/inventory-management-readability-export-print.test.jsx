/* eslint-disable testing-library/no-node-access */
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
import InventoryManagement from "../components/InventoryManagement";

const mockPdfSave = jest.fn();
const mockPdfInstances = [];

jest.mock("jspdf", () => {
  class MockJsPDF {
    constructor(config = {}) {
      this.config = config;
      this.internal = {
        pageSize: {
          getWidth: () => 842,
          getHeight: () => 595,
        },
      };
      this.lastAutoTable = { finalY: 48 };
      this.html = jest.fn().mockResolvedValue(undefined);
      this.autoTable = jest.fn(() => this);
      this.addPage = jest.fn(() => this);
      this.addImage = jest.fn();
      this.line = jest.fn();
      this.rect = jest.fn();
      this.save = mockPdfSave;
      this.setDrawColor = jest.fn();
      this.setFont = jest.fn();
      this.setFontSize = jest.fn();
      this.setLineWidth = jest.fn();
      this.setTextColor = jest.fn();
      this.text = jest.fn();
      mockPdfInstances.push(this);
    }
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

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 101, role_type: "SYSTEM_ADMIN", clinic_id: 7, facility_id: 7 },
  }),
}));

const inventoryRecords = [
  {
    id: 1,
    clinic_id: 7,
    vaccine_id: 1,
    vaccine_name: "BCG",
    beginning_balance: 186,
    received_during_period: 40,
    transferred_in: 3,
    transferred_out: 2,
    expired_wasted: 1,
    issuance: 30,
    stock_on_hand: 196,
    lot_batch_number: "MULTIPLE LOTS (3)",
    expiry_date: "2026-12-31",
    period_start: "2026-05-01",
    period_end: "2026-05-31",
  },
  {
    id: 2,
    clinic_id: 7,
    vaccine_id: 2,
    vaccine_name: "MMR",
    beginning_balance: 290,
    received_during_period: 10,
    transferred_in: 0,
    transferred_out: 1,
    expired_wasted: 0,
    issuance: 9,
    stock_on_hand: 290,
    lot_batch_number: "MMR-LOT-002",
    expiry_date: "2027-03-20",
    period_start: "2026-05-01",
    period_end: "2026-05-31",
  },
];

const renderInventoryRoute = (initialEntry = "/inventory?tab=inventory_sheet") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/inventory" element={<InventoryManagement />} />
      </Routes>
    </MemoryRouter>,
  );

const waitForInventorySheetReady = async () => {
  await waitFor(() => {
    expect(apiClient.getFacilityInfo).toHaveBeenCalled();
  });
  await waitFor(() => {
    expect(apiClient.getVaccineInventory).toHaveBeenCalledWith({
      clinic_id: 7,
    });
  });

  await screen.findByRole("button", { name: /^generate report$/i });
  expect(screen.getByTestId("inventory-sheet-panel")).toBeInTheDocument();
};

const openGenerateReportModal = async () => {
  fireEvent.click(screen.getByRole("button", { name: /^generate report$/i }));
  return screen.findByRole("dialog", { name: /generate report/i });
};

const setModalPeriodRange = (modal, { period, fromDate, toDate }) => {
  fireEvent.change(within(modal).getByLabelText(/^period$/i), {
    target: { value: period },
  });

  if (period === "custom") {
    fireEvent.change(within(modal).getByLabelText(/from date/i), {
      target: { value: fromDate },
    });
    fireEvent.change(within(modal).getByLabelText(/to date/i), {
      target: { value: toDate },
    });
  }
};

describe("Inventory Management report generation", () => {
  let originalPrint;

  beforeAll(() => {
    originalPrint = window.print;
    Object.defineProperty(window, "print", {
      configurable: true,
      writable: true,
      value: jest.fn(),
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
    mockPdfInstances.length = 0;
    localStorage.clear();
    sessionStorage.clear();
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    apiClient.getFacilityInfo.mockResolvedValue({
      name: "San Nicolas Health Center",
      address: "San Nicolas",
      city: "Pasig",
      barangay: "San Nicolas",
      province: "Metro Manila",
    });
    apiClient.getVaccines.mockResolvedValue([]);
    apiClient.getVaccineInventory.mockResolvedValue(inventoryRecords);
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.fetch;
  });

  test("defaults the Generate Report modal to a period selector and computed date range", async () => {
    renderInventoryRoute();
    await waitForInventorySheetReady();

    const modal = await openGenerateReportModal();

    expect(within(modal).getByLabelText(/^period$/i)).toHaveValue("month");
    expect(within(modal).getByLabelText(/report date/i)).toBeInTheDocument();
    expect(within(modal).queryByText(/all available records/i)).not.toBeInTheDocument();
    expect(
      within(modal).getByText(/[A-Z][a-z]+ \d{1,2}, \d{4} - [A-Z][a-z]+ \d{1,2}, \d{4}/),
    ).toBeInTheDocument();

    fireEvent.change(within(modal).getByLabelText(/^period$/i), {
      target: { value: "custom" },
    });

    expect(within(modal).getByLabelText(/from date/i)).toBeInTheDocument();
    expect(within(modal).getByLabelText(/to date/i)).toBeInTheDocument();
  });

  test("inventory sheet PDF export reuses the loaded inventory source and renders the selected period label", async () => {
    renderInventoryRoute();
    await waitForInventorySheetReady();

    const modal = await openGenerateReportModal();
    setModalPeriodRange(modal, {
      period: "custom",
      fromDate: "2026-05-03",
      toDate: "2026-05-06",
    });

    fireEvent.change(within(modal).getByLabelText(/report date/i), {
      target: { value: "2026-04-08" },
    });
    fireEvent.change(within(modal).getByLabelText(/^format/i), {
      target: { value: "pdf" },
    });
    fireEvent.click(within(modal).getByRole("button", { name: /generate report/i }));

    await waitFor(() => {
      expect(mockPdfSave).toHaveBeenCalledWith("inventory-sheet-2026-04-08.pdf");
    });

    expect(apiClient.getVaccineInventory).toHaveBeenCalledTimes(1);

    const pdfInstance = mockPdfInstances.at(-1);
    expect(pdfInstance.config).toEqual(
      expect.objectContaining({
        orientation: "landscape",
        format: "legal",
      }),
    );
    expect(pdfInstance.html).not.toHaveBeenCalled();
    expect(pdfInstance.autoTable).toHaveBeenCalled();
    expect(pdfInstance.text).toHaveBeenCalledWith(
      "FOR THE PERIOD: MAY 3, 2026 - MAY 6, 2026",
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: "right" }),
    );
  });

  test("DOH/LGU print preview uses the stock-form template with live rows and the selected reporting range", async () => {
    renderInventoryRoute();
    await waitForInventorySheetReady();

    const inventoryPanel = screen.getByTestId("inventory-sheet-panel");
    const liveBcgRow = within(inventoryPanel)
      .getByText("BCG", { selector: "td" })
      .closest("tr");
    expect(liveBcgRow).not.toBeNull();
    expect(within(liveBcgRow).getByText("186")).toBeInTheDocument();

    const modal = await openGenerateReportModal();
    fireEvent.change(within(modal).getByLabelText(/report type/i), {
      target: { value: "doh-lgu-stock-form" },
    });
    fireEvent.change(within(modal).getByLabelText(/^format/i), {
      target: { value: "print" },
    });
    setModalPeriodRange(modal, {
      period: "custom",
      fromDate: "2026-05-03",
      toDate: "2026-05-06",
    });
    fireEvent.change(within(modal).getByLabelText(/report date/i), {
      target: { value: "2026-04-08" },
    });

    jest.useFakeTimers();
    fireEvent.click(within(modal).getByRole("button", { name: /generate report/i }));

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    const printReport = screen.getByTestId("inventory-print-report");
    expect(printReport).toBeInTheDocument();
    expect(
      document.getElementById("inventory-print-page-style"),
    ).toHaveTextContent("size: legal landscape");
    expect(printReport).toHaveTextContent(
      "METRO MANILA CENTER FOR HEALTH DEVELOPMENT",
    );
    expect(printReport).toHaveTextContent(
      "HEALTH FACILITY MONTHLY VACCINE STOCK INVENTORY REPORT",
    );
    expect(printReport).toHaveTextContent(
      "DOH and LGU Utilization / Stock Inventory Form",
    );
    expect(
      screen.getByTestId("inventory-print-month-year"),
    ).toHaveTextContent("Reporting Period: MAY 3, 2026 - MAY 6, 2026");

    const printedBcgRow = within(printReport)
      .getByText("BCG", { selector: "td" })
      .closest("tr");
    expect(printedBcgRow).not.toBeNull();
    expect(within(printedBcgRow).getByText("186")).toBeInTheDocument();
    expect(printReport).toHaveTextContent("Human Papillomavirus Vaccine");
    expect(apiClient.getVaccineInventory).toHaveBeenCalledTimes(1);

  });

  test("DOH/LGU PDF export uses the direct stock-form renderer with the selected reporting range", async () => {
    renderInventoryRoute();
    await waitForInventorySheetReady();

    const modal = await openGenerateReportModal();
    fireEvent.change(within(modal).getByLabelText(/report type/i), {
      target: { value: "doh-lgu-stock-form" },
    });
    fireEvent.change(within(modal).getByLabelText(/^format/i), {
      target: { value: "pdf" },
    });
    setModalPeriodRange(modal, {
      period: "custom",
      fromDate: "2026-05-03",
      toDate: "2026-05-06",
    });
    fireEvent.change(within(modal).getByLabelText(/report date/i), {
      target: { value: "2026-04-08" },
    });
    fireEvent.click(within(modal).getByRole("button", { name: /generate report/i }));

    await waitFor(() => {
      expect(mockPdfSave).toHaveBeenCalledWith(
        "doh-lgu-stock-inventory-report-2026-04-08.pdf",
      );
    });

    const pdfInstance = mockPdfInstances.at(-1);
    expect(pdfInstance.config).toEqual(
      expect.objectContaining({
        orientation: "landscape",
        format: "legal",
      }),
    );
    expect(pdfInstance.html).not.toHaveBeenCalled();
    expect(pdfInstance.autoTable).toHaveBeenCalledTimes(1);

    const headerTexts = pdfInstance.text.mock.calls.map(([text]) => text);
    expect(headerTexts).toContain(
      "METRO MANILA CENTER FOR HEALTH DEVELOPMENT",
    );
    expect(headerTexts).toContain(
      "HEALTH FACILITY MONTHLY VACCINE STOCK INVENTORY REPORT",
    );
    expect(headerTexts).toContain("DOH and LGU Utilization / Stock Inventory Form");
    expect(headerTexts).toContain("MAY 3, 2026 - MAY 6, 2026");

    const autoTableConfig = pdfInstance.autoTable.mock.calls[0][0];
    expect(autoTableConfig.body[0][1]).toBe("BCG");
    expect(autoTableConfig.body[0][2]).toBe("186");
    expect(
      autoTableConfig.body.some(
        (row) => row[1] === "Human Papillomavirus Vaccine" && row[2] === "0",
      ),
    ).toBe(true);
    expect(apiClient.getVaccineInventory).toHaveBeenCalledTimes(1);
  });
});
