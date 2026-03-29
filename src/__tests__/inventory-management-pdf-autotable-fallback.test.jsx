import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import apiClient from "../utils/api";
import InventoryManagement from "../components/InventoryManagement";

const mockPdfSave = jest.fn();
const mockPdfConfigs = [];
const mockAutoTablePlugin = jest.fn();

const mockApplyAutoTable = (doc, options = {}) => {
  if (typeof options.startY === "number") {
    doc.lastAutoTable = { finalY: options.startY + 24 };
  }

  return doc;
};

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
    addPage = jest.fn(() => this);
    setFont = jest.fn();
    setFontSize = jest.fn();
    text = jest.fn();
    line = jest.fn();
    setTextColor = jest.fn();
    save = mockPdfSave;
  }

  return {
    __esModule: true,
    default: MockJsPDF,
  };
});

jest.mock("jspdf-autotable", () => ({
  __esModule: true,
  default: jest.fn((doc, options = {}) => {
    mockAutoTablePlugin(doc, options);
    return mockApplyAutoTable(doc, options);
  }),
  autoTable: jest.fn((doc, options = {}) => {
    mockAutoTablePlugin(doc, options);
    return mockApplyAutoTable(doc, options);
  }),
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

const renderInventoryRoute = (initialEntry = "/inventory?tab=inventory_sheet") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/inventory" element={<InventoryManagement />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Inventory Management PDF autoTable fallback", () => {
  const waitForInventoryToolbar = async () => {
    await waitFor(() => {
      expect(apiClient.getVaccineInventory).toHaveBeenCalledWith({
        clinic_id: 7,
      });
    });

    await screen.findByRole("button", { name: /download pdf/i });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPdfSave.mockClear();
    mockPdfConfigs.length = 0;
    mockAutoTablePlugin.mockClear();
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
    apiClient.getVaccineInventory.mockResolvedValue([
      {
        id: 1,
        clinic_id: 7,
        vaccine_id: 1,
        vaccine_name: "BCG",
        beginning_balance: 10,
        received_during_period: 4,
        lot_batch_number: "LOT-BCG-001",
        transferred_in: 0,
        transferred_out: 1,
        expired_wasted: 0,
        issuance: 5,
      },
    ]);
    apiClient.getVaccines.mockResolvedValue([]);
  });

  afterEach(() => {
    delete global.fetch;
  });

  test("downloads the inventory sheet PDF even when jsPDF instances do not expose doc.autoTable", async () => {
    renderInventoryRoute();

    await waitForInventoryToolbar();

    fireEvent.click(
      await screen.findByRole("button", { name: /download inventory sheet pdf/i }),
    );

    await waitFor(() => {
      expect(mockPdfSave).toHaveBeenCalledWith(
        expect.stringMatching(/^inventory-sheet-/i),
      );
    });

    expect(mockAutoTablePlugin).toHaveBeenCalled();
    expect(mockPdfConfigs.at(-1)).toEqual(
      expect.objectContaining({ orientation: "landscape", format: "legal" }),
    );
  });

});
