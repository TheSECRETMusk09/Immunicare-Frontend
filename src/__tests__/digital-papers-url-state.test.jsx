import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import DigitalPapersDashboard from "../pages/DigitalPapersDashboard";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getPaperTemplates: jest.fn(),
    getDownloadHistory: jest.fn(),
    getDocumentAlerts: jest.fn(),
  },
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 100, role_type: "SYSTEM_ADMIN", role: "system_admin" },
    isAdmin: true,
    isAdminOrSuperAdmin: true,
    isHealthcareWorker: false,
  }),
}));

jest.mock("../components/PaperConfiguration", () => () => (
  <div>Paper Configuration Content</div>
));
jest.mock("../components/DownloadCenter", () => () => (
  <div>Download Center Content</div>
));
jest.mock("../components/MonitoringDashboard", () => () => (
  <div>Monitoring Dashboard Content</div>
));
jest.mock("../components/DocumentTemplates", () => () => (
  <div>Document Templates Content</div>
));

const apiClient = require("../utils/api").default;

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

const renderRoute = (initialEntry = "/digital-papers?tab=download_center") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/digital-papers"
          element={
            <>
              <DigitalPapersDashboard />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe("Digital papers URL state", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.getPaperTemplates.mockResolvedValue({ data: [] });
    apiClient.getDownloadHistory.mockResolvedValue({ data: [], pagination: { total: 0 } });
    apiClient.getDocumentAlerts.mockResolvedValue({ data: [] });
  });

  test("deep links load the matching tab and tab clicks keep the URL in sync", async () => {
    renderRoute("/digital-papers?tab=download_center");

    expect(await screen.findByText("Download Center Content")).toBeInTheDocument();
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "tab=download_center",
    );

    fireEvent.click(screen.getByRole("button", { name: /document templates/i }));

    await waitFor(() => {
      expect(screen.getByText("Document Templates Content")).toBeInTheDocument();
    });

    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "tab=document_templates",
    );
  });
});
