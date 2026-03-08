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

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getFacilityInfo: jest.fn(),
    createVaccineInventoryTransaction: jest.fn(),
  },
}));

const renderInventoryRoute = (initialEntry = "/inventory?tab=inventory_sheet") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/inventory" element={<InventoryManagement />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Inventory Management readability, CSV export, and print behavior", () => {
  const mockCreateObjectURL = jest.fn(() => "blob:inventory-export");
  const mockRevokeObjectURL = jest.fn();
  const mockPrint = jest.fn();

  class MockBlob {
    constructor(parts = [], options = {}) {
      this.parts = parts;
      this.type = options.type || "";
      this.size = parts.reduce(
        (total, part) => total + String(part ?? "").length,
        0,
      );
      this.__text = parts.map((part) => String(part ?? "")).join("");
    }

    text() {
      return Promise.resolve(this.__text);
    }
  }

  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let originalPrint;
  let originalBlob;

  const waitForInventoryModuleReady = async () => {
    await waitFor(() => {
      expect(apiClient.getFacilityInfo).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByText(/loading\.\.\./i)).not.toBeInTheDocument();
    });
  };

  beforeAll(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    originalPrint = window.print;
    originalBlob = global.Blob;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: mockCreateObjectURL,
    });

    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: mockRevokeObjectURL,
    });

    Object.defineProperty(window, "print", {
      configurable: true,
      writable: true,
      value: mockPrint,
    });

    Object.defineProperty(global, "Blob", {
      configurable: true,
      writable: true,
      value: MockBlob,
    });
  });

  afterAll(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });

    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });

    Object.defineProperty(window, "print", {
      configurable: true,
      writable: true,
      value: originalPrint,
    });

    Object.defineProperty(global, "Blob", {
      configurable: true,
      writable: true,
      value: originalBlob,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    apiClient.getFacilityInfo.mockResolvedValue({
      name: "Test Health Center",
      province: "Test Province",
      city: "Test City",
      barangay: "Test Barangay",
    });
  });

  test("shows expanded inventory headers and bold vaccine names without layout changes", async () => {
    renderInventoryRoute();

    await waitForInventoryModuleReady();

    expect(screen.getByText(/beginning/i)).toBeInTheDocument();
    expect(screen.getByText(/received/i)).toBeInTheDocument();
    expect(screen.getByText(/batch number/i)).toBeInTheDocument();
    expect(screen.getByText(/stock movement/i)).toBeInTheDocument();
    expect(screen.getByText(/expired\s*\//i)).toBeInTheDocument();
    expect(screen.getByText(/available/i)).toBeInTheDocument();
    expect(screen.getByText(/issued/i)).toBeInTheDocument();
    expect(screen.getByText(/stock on/i)).toBeInTheDocument();
    expect(screen.getByText(/hand/i)).toBeInTheDocument();

    expect(screen.getByRole("table")).toBeInTheDocument();

    expect(screen.getByText("BCG")).toHaveClass("font-bold");
  });

  test("improves stock alert table readability with bold item names and larger value text", async () => {
    renderInventoryRoute("/inventory?tab=stock_alerts");

    await waitForInventoryModuleReady();

    expect(
      screen.getByRole("heading", { name: /critical stock/i }),
    ).toBeInTheDocument();

    expect(screen.getByText("BCG")).toHaveClass("font-semibold");
    expect(screen.getByText("BCG")).toHaveClass("text-sm");

    const [criticalStockTable] = screen.getAllByRole("table");
    const outOfStockValueCell = within(criticalStockTable).getAllByText("0")[0];
    expect(outOfStockValueCell).toHaveClass("text-sm");
  });

  test("exports CSV with metadata lines and exact inventory table columns including TOTAL row", async () => {
    const appendSpy = jest.spyOn(document.body, "appendChild");
    const removeSpy = jest.spyOn(document.body, "removeChild");
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    renderInventoryRoute();

    await waitForInventoryModuleReady();

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
    });

    const createdBlob = mockCreateObjectURL.mock.calls[0][0];
    const csvText = await createdBlob.text();
    const lines = csvText.split("\n");

    expect(lines[0]).toMatch(/IMMUNICARE HEALTH CENTER - VACCINE INVENTORY/i);
    expect(lines[1]).toMatch(/^Report Date:/i);
    expect(lines[2]).toMatch(/^Generated:/i);

    const headerLine = lines[4];
    expect(headerLine).toContain("A");
    expect(headerLine).toContain("ITEMS");
    expect(headerLine).toContain("B Beginning Balance");
    expect(headerLine).toContain("C Received");
    expect(headerLine).toContain("Lot / Batch Number");
    expect(headerLine).toContain("Stock Movement (In / Out)");
    expect(headerLine).toContain("Expired / Wasted");
    expect(headerLine).toContain("G Total Available");
    expect(headerLine).toContain("H Issued");
    expect(headerLine).toContain("I+J Stock On Hand");

    const dataRows = lines.slice(5);
    expect(dataRows[0]).toMatch(/^1,BCG,/);
    expect(dataRows[dataRows.length - 1]).toContain("TOTAL");

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();

    appendSpy.mockRestore();
    removeSpy.mockRestore();
    clickSpy.mockRestore();
  });

  test("print action switches to inventory sheet and applies print-specific class behavior", async () => {
    renderInventoryRoute("/inventory?tab=reports");

    await waitForInventoryModuleReady();

    jest.useFakeTimers();

    const printButton = screen.getByRole("button", { name: /print \/ pdf/i });
    fireEvent.click(printButton);

    expect(document.body).toHaveClass("printing-inventory");
    expect(screen.getByTestId("inventory-print-report")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(mockPrint).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(document.body).not.toHaveClass("printing-inventory");
    expect(screen.queryByTestId("inventory-print-report")).not.toBeInTheDocument();

    jest.useRealTimers();
  });

  test("print report follows required header, column structure, and totals without actions", async () => {
    renderInventoryRoute();

    await waitForInventoryModuleReady();

    const reportDateInput = screen.getByLabelText(/report date/i);
    fireEvent.change(reportDateInput, { target: { value: "2026-11-15" } });

    const screenRows = screen.getAllByRole("row");
    const bcgRow = screenRows.find(
      (row) => within(row).queryByText("BCG") !== null,
    );
    const bcgInputs = within(bcgRow).getAllByRole("spinbutton");
    fireEvent.change(bcgInputs[0], { target: { value: "10" } });
    fireEvent.change(bcgInputs[1], { target: { value: "4" } });
    fireEvent.change(bcgInputs[2], { target: { value: "3" } });
    fireEvent.change(bcgInputs[3], { target: { value: "1" } });
    fireEvent.change(bcgInputs[4], { target: { value: "2" } });
    fireEvent.change(bcgInputs[5], { target: { value: "5" } });

    const firstLotInput = within(bcgRow).getByPlaceholderText("---");
    fireEvent.change(firstLotInput, {
      target: { value: "LOT-001" },
    });

    const bcgDiluentRow = screenRows.find(
      (row) => within(row).queryByText("BCG, Diluent") !== null,
    );
    const bcgDiluentInputs = within(bcgDiluentRow).getAllByRole("spinbutton");
    fireEvent.change(bcgDiluentInputs[0], { target: { value: "5" } });
    fireEvent.change(bcgDiluentInputs[1], { target: { value: "1" } });
    fireEvent.change(bcgDiluentInputs[2], { target: { value: "0" } });
    fireEvent.change(bcgDiluentInputs[3], { target: { value: "0" } });
    fireEvent.change(bcgDiluentInputs[4], { target: { value: "1" } });
    fireEvent.change(bcgDiluentInputs[5], { target: { value: "2" } });

    jest.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: /print \/ pdf/i }));

    const printReport = screen.getByTestId("inventory-print-report");
    const printHeader = within(printReport).getByTestId("inventory-print-header");
    const printMonthYear = within(printReport).getByTestId("inventory-print-month-year");

    expect(printHeader).toHaveTextContent("IMMUNICARE HEALTH CENTER");
    expect(printHeader).toHaveTextContent("BARANGAY SAN NICOLAS");
    expect(printHeader).toHaveTextContent("PASIG CITY");
    expect(printHeader).toHaveTextContent("VACCINE INVENTORY SHEET");
    expect(printMonthYear).toHaveTextContent("November 2026");

    const printTable = within(printReport).getByTestId("inventory-print-table");
    expect(within(printTable).getByText(/^In$/)).toBeInTheDocument();
    expect(within(printTable).getByText(/^Out$/)).toBeInTheDocument();
    expect(within(printTable).queryByText(/^Act$/i)).not.toBeInTheDocument();

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
      "4",
      "LOT-001",
      "3",
      "1",
      "2",
      "14",
      "5",
      "9",
    ]);

    const totalRow = within(printTable).getByTestId("inventory-print-total-row");
    const totalCells = within(totalRow)
      .getAllByRole("cell", { hidden: true })
      .map((cell) => cell.textContent.trim());

    expect(totalCells).toEqual([
      "TOTAL",
      "15",
      "5",
      "-",
      "3",
      "1",
      "3",
      "20",
      "7",
      "12",
    ]);

    act(() => {
      jest.advanceTimersByTime(200);
    });
    jest.useRealTimers();
  });
});
