import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import DownloadCenter from "../components/DownloadCenter";
import apiClient from "../utils/api";

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

    apiClient.getDownloadHistory.mockResolvedValue({ data: [] });
    apiClient.getInfants.mockResolvedValue({
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

  test("uses searchable infant selection and submits the selected infant for document generation", async () => {
    render(
      <MemoryRouter>
        <DownloadCenter />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Download Center")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /generate new document/i }));

    const infantPickerTrigger = screen.getAllByRole("button", { name: /select infant/i })[0];
    fireEvent.click(infantPickerTrigger);

    const searchInput = screen.getByPlaceholderText(
      /search by name, control number, or date of birth/i,
    );
    fireEvent.change(searchInput, { target: { value: "DEMO30-INF-003867" } });

    expect(screen.getByText("Alvin Torres")).toBeInTheDocument();
    expect(screen.getByText("Feb 27, 2026")).toBeInTheDocument();
    expect(screen.queryByText("Noel Bacani")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /alvin torres/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /alvin torres \(feb 27, 2026\)/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Select Template"), {
      target: { value: "7" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^generate document$/i }));

    await waitFor(() => {
      expect(apiClient.generateDocument).toHaveBeenCalledWith("7", expect.objectContaining({
        infant_id: "1",
        template_id: "7",
      }));
    });
  });
});
