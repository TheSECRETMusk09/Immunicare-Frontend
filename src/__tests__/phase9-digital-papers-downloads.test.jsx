import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import apiClient from "../utils/api";
import ImmunizationRecordPage from "../pages/digital-papers/ImmunizationRecordPage";
import VaccineSchedulePage from "../pages/digital-papers/VaccineSchedulePage";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getInfant: jest.fn(),
  },
}));

jest.mock("../components/ImmunizationRecordBooklet", () => ({
  __esModule: true,
  default: ({ infantId }) => (
    <div>
      <div className="record-booklet-print">Printable record booklet {infantId}</div>
      <style>{`.record-booklet-print { color: #111827; }`}</style>
    </div>
  ),
}));

jest.mock("../components/VaccineScheduleBooklet", () => ({
  __esModule: true,
  default: ({ infantId }) => (
    <div id="vaccine-schedule-print">Printable vaccine schedule {infantId}</div>
  ),
}));

const renderWithRoute = (path, element) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/digital-papers/immunization-records/:infantId" element={element} />
        <Route path="/digital-papers/vaccine-schedule/:infantId" element={element} />
      </Routes>
    </MemoryRouter>,
  );

describe("Phase 9 digital papers downloads", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;

  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();
    apiClient.getInfant.mockResolvedValue({
      id: 7,
      first_name: "Jamie",
      last_name: "Doe",
      dob: "2025-01-01",
      sex: "F",
    });
    URL.createObjectURL = jest.fn(() => "blob:digital-paper");
    URL.revokeObjectURL = jest.fn();
    HTMLAnchorElement.prototype.click = jest.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    HTMLAnchorElement.prototype.click = originalClick;
  });

  test("immunization record page downloads the printable record as a PDF fallback when embedded controls are unavailable", async () => {
    renderWithRoute(
      "/digital-papers/immunization-records/7",
      <ImmunizationRecordPage />,
    );

    expect(
      await screen.findByRole("heading", { name: /child immunization record booklet/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  test("immunization record page offers Word export", async () => {
    renderWithRoute(
      "/digital-papers/immunization-records/7",
      <ImmunizationRecordPage />,
    );

    expect(
      await screen.findByRole("heading", { name: /child immunization record booklet/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /download word/i }));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  test("vaccine schedule page downloads the printable schedule as a PDF fallback when embedded controls are unavailable", async () => {
    renderWithRoute(
      "/digital-papers/vaccine-schedule/7",
      <VaccineSchedulePage />,
    );

    expect(
      await screen.findByRole("heading", { name: /vaccine schedule booklet/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  test("vaccine schedule page offers Word export", async () => {
    renderWithRoute(
      "/digital-papers/vaccine-schedule/7",
      <VaccineSchedulePage />,
    );

    expect(
      await screen.findByRole("heading", { name: /vaccine schedule booklet/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /download word/i }));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });
});
