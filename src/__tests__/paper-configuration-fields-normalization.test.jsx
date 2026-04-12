import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import PaperConfiguration from "../components/PaperConfiguration";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getPaperTemplates: jest.fn(),
    createPaperTemplate: jest.fn(),
    updatePaperTemplate: jest.fn(),
    deletePaperTemplate: jest.fn(),
  },
}));

const apiClient = require("../utils/api").default;

describe("PaperConfiguration template field normalization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders and edits serialized template fields without crashing", async () => {
    apiClient.getPaperTemplates.mockResolvedValue({
      data: [
        {
          id: 1,
          name: "Immunization Record",
          description: "Child vaccination record booklet",
          template_type: "IMMUNIZATION_RECORD",
          is_active: true,
          fields:
            '[{"field":"child_name","label":"Child Name","source":"patients.full_name","required":true}]',
        },
      ],
    });

    render(<PaperConfiguration />);

    expect(await screen.findByText("Immunization Record")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    await waitFor(() => {
      expect(screen.getByText(/edit template/i)).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("child_name")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Child Name")).toBeInTheDocument();
    expect(screen.getByDisplayValue("patients.full_name")).toBeInTheDocument();
  });
});
