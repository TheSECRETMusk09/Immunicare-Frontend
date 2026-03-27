import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AddInfantModal from "../components/AddInfantModal";
import apiClient from "../utils/api";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getGuardians: jest.fn(),
  },
}));

jest.mock("../services/infantService", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    update: jest.fn(),
  },
}));

describe("AddInfantModal guardian lookup", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  test("does not preload the full guardian directory on open", () => {
    render(
      <AddInfantModal
        isOpen
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

    expect(screen.getByLabelText(/search guardian/i)).toBeInTheDocument();
    expect(apiClient.getGuardians).not.toHaveBeenCalled();
  });

  test("searches guardians remotely after debounce", async () => {
    apiClient.getGuardians.mockResolvedValue({
      data: [{ id: 12, name: "Maria Clara Santos", username: "maria.santos" }],
      meta: {
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      },
    });

    render(
      <AddInfantModal
        isOpen
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/search guardian/i), {
      target: { value: "ma" },
    });

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() =>
      expect(apiClient.getGuardians).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "ma",
          limit: 20,
          view: "lookup",
        }),
        expect.objectContaining({
          disableRetry: true,
          signal: expect.any(Object),
        }),
      ),
    );

    expect(await screen.findByText(/maria clara santos/i)).toBeInTheDocument();
  });

  test("keeps the current guardian selectable while editing", () => {
    render(
      <AddInfantModal
        isOpen
        onClose={jest.fn()}
        onSuccess={jest.fn()}
        editingInfant={{
          id: 77,
          first_name: "Juan",
          last_name: "Dela Cruz",
          dob: "2024-01-02",
          guardian_id: 42,
          guardian_name: "Current Guardian",
        }}
      />,
    );

    expect(screen.getByRole("option", { name: /current guardian/i })).toBeInTheDocument();
  });
});
