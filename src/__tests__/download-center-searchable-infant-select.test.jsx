import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import DownloadCenter from "../components/DownloadCenter";
import apiClient from "../utils/api";

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    isAdmin: true,
  }),
}));

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getDownloadHistory: jest.fn(),
    getInfants: jest.fn(),
    getPaperTemplates: jest.fn(),
    generateDocument: jest.fn(),
    downloadDocument: jest.fn(),
  },
}));

describe("DownloadCenter searchable infant selection", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const initialInfants = {
      data: [
        {
          id: 1,
          first_name: "Alvin",
          last_name: "Torres",
          dob: "2026-02-27T16:00:00.000Z",
          control_number: "DEMO30-INF-003867",
        },
        {
          id: 2,
          first_name: "Noel",
          last_name: "Bacani",
          dob: "2025-10-09T16:00:00.000Z",
          control_number: "DEMO30-INF-002391",
        },
      ],
    };

    apiClient.getDownloadHistory.mockResolvedValue({ data: [] });
    apiClient.getInfants.mockResolvedValue(initialInfants);
    apiClient.getInfants
      .mockResolvedValueOnce(initialInfants)
      .mockResolvedValueOnce({
        data: [
          {
            id: 5001,
            first_name: "Christian",
            last_name: "Samorin",
            dob: "2026-03-25T16:00:00.000Z",
            control_number: "INF-2026-357447",
          },
        ],
      });
    apiClient.getPaperTemplates.mockResolvedValue({
      data: [
        {
          id: 7,
          name: "Immunization Record",
          template_type: "PDF",
        },
      ],
    });
    apiClient.generateDocument.mockResolvedValue({ success: true });
  });

  test("searches infants from the backend so document generation can find records outside the initial preload", async () => {
    render(
      <MemoryRouter>
        <DownloadCenter />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Download Center")).toBeInTheDocument();

    expect(apiClient.getInfants).toHaveBeenCalledWith({
      limit: 10000,
      scope: "system",
    });

    fireEvent.click(screen.getAllByRole("button", { name: /generate new document/i })[0]);

    const infantPickerTrigger = screen.getAllByRole("button", { name: /select infant/i })[0];
    fireEvent.click(infantPickerTrigger);

    const searchInput = screen.getByPlaceholderText(
      /search by name, control number, or date of birth/i,
    );
    fireEvent.change(searchInput, { target: { value: "christian samorin" } });

    await waitFor(() => {
      expect(apiClient.getInfants).toHaveBeenCalledWith({
        limit: 25,
        search: "christian samorin",
        scope: "system",
      });
    });

    expect(await screen.findByText("Christian Samorin")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /christian samorin/i }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /christian samorin/i }).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByDisplayValue("Select Template"), {
      target: { value: "7" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^generate document$/i }));

    await waitFor(() => {
      expect(apiClient.generateDocument).toHaveBeenCalledWith("7", expect.objectContaining({
        infant_id: "5001",
        template_id: "7",
      }));
    });
  });
});
