import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import DownloadCenter from "../components/DownloadCenter";
import ImmunizationChartPage from "../pages/digital-papers/ImmunizationChartPage";
import ImmunizationRecordPage from "../pages/digital-papers/ImmunizationRecordPage";
import VaccineSchedulePage from "../pages/digital-papers/VaccineSchedulePage";
import apiClient from "../utils/api";

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    isAdmin: true,
    isGuardian: false,
  }),
}));

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getInfant: jest.fn(),
    getInfants: jest.fn(),
    getDownloadHistory: jest.fn(),
    getPaperTemplates: jest.fn(),
  },
}));

jest.mock("../components/ImmunizationChart", () => ({
  __esModule: true,
  default: ({ infantId }) => <div>Chart content {infantId}</div>,
}));

jest.mock("../components/InfantPersonalRecord", () => ({
  __esModule: true,
  default: ({ infantId }) => <div>Personal record {infantId}</div>,
}));

jest.mock("../components/ImmunizationRecordBooklet", () => ({
  __esModule: true,
  default: ({ infantId }) => <div>Record booklet {infantId}</div>,
}));

jest.mock("../components/VaccineScheduleBooklet", () => ({
  __esModule: true,
  default: ({ infantId }) => <div>Schedule booklet {infantId}</div>,
}));

const mockInfant = {
  id: 7,
  first_name: "Jamie",
  last_name: "Doe",
  middle_name: "R",
  dob: "2025-01-01",
  sex: "F",
  control_number: "INF-2025-0007",
};

const RouteProbe = () => {
  const location = useLocation();

  return (
    <div data-testid="route-probe">
      <div data-testid="route-pathname">{location.pathname}</div>
      <div data-testid="route-search">{location.search}</div>
      <div data-testid="route-return-to">{location.state?.returnTo || ""}</div>
    </div>
  );
};

const renderWithRoutes = (initialEntries) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="/digital-papers"
          element={
            <>
              <DownloadCenter />
              <RouteProbe />
            </>
          }
        />
        <Route
          path="/digital-papers/immunization-chart/:infantId"
          element={
            <>
              <ImmunizationChartPage />
              <RouteProbe />
            </>
          }
        />
        <Route
          path="/digital-papers/immunization-records/:infantId"
          element={
            <>
              <ImmunizationRecordPage />
              <RouteProbe />
            </>
          }
        />
        <Route
          path="/digital-papers/vaccine-schedule/:infantId"
          element={
            <>
              <VaccineSchedulePage />
              <RouteProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe("digital papers back navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    apiClient.getDownloadHistory.mockResolvedValue({ data: [] });
    apiClient.getPaperTemplates.mockResolvedValue({ data: [] });
    apiClient.getInfants.mockResolvedValue({
      data: {
        infants: [mockInfant],
      },
    });
    apiClient.getInfant.mockResolvedValue({
      data: mockInfant,
    });
  });

  test("opening a document from Download Center preserves the list context and returns to it", async () => {
    renderWithRoutes([
      {
        pathname: "/digital-papers",
        search: "?tab=download_center&source=list_context",
      },
    ]);

    const openDocumentButtons = await screen.findAllByRole("button", {
      name: /open document/i,
    });
    fireEvent.click(openDocumentButtons[0]);

    expect(
      await screen.findByRole("banner", {
        name: /immunization chart page header/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("route-return-to")).toHaveTextContent(
      "/digital-papers?tab=download_center&source=list_context",
    );

    fireEvent.click(
      within(
        screen.getByRole("banner", {
          name: /immunization chart page header/i,
        }),
      ).getByRole("button", { name: /back to list/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("route-pathname")).toHaveTextContent(
        "/digital-papers",
      );
    });
    expect(screen.getByTestId("route-search")).toHaveTextContent(
      "tab=download_center&source=list_context",
    );
  });

  test.each([
    {
      label: "immunization chart page",
      path: "/digital-papers/immunization-chart/7",
      header: /immunization chart page header/i,
    },
    {
      label: "immunization record page",
      path: "/digital-papers/immunization-records/7",
      header: /child immunization record booklet/i,
    },
    {
      label: "vaccine schedule page",
      path: "/digital-papers/vaccine-schedule/7",
      header: /vaccine schedule booklet/i,
    },
  ])("$label shows Back to List and returns to the originating list context", async ({ path, header }) => {
    renderWithRoutes([
      {
        pathname: path,
        state: {
          returnTo: "/digital-papers?tab=download_center&source=list_context",
        },
      },
    ]);

    const banner = await screen.findByRole("banner", { name: header });
    expect(
      within(banner).getByRole("button", { name: /back to list/i }),
    ).toBeInTheDocument();

    fireEvent.click(within(banner).getByRole("button", { name: /back to list/i }));

    await waitFor(() => {
      expect(screen.getByTestId("route-pathname")).toHaveTextContent(
        "/digital-papers",
      );
    });
    expect(screen.getByTestId("route-search")).toHaveTextContent(
      "tab=download_center&source=list_context",
    );
  });
});
