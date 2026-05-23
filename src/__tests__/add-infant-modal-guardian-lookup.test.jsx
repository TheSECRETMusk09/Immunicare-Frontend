import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AddInfantModal from "../components/AddInfantModal";
import apiClient from "../utils/api";
import infantService from "../services/infantService";

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

  test("submits successfully without a blood type while preserving required dropdown fields", async () => {
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
    infantService.create.mockResolvedValue({ id: 99 });

    render(
      <AddInfantModal
        isOpen
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Jamie" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/date of birth/i), {
      target: { value: "2026-05-20" },
    });
    fireEvent.change(screen.getByLabelText(/gender/i), {
      target: { value: "female" },
    });
    fireEvent.change(screen.getByLabelText(/search guardian/i), {
      target: { value: "maria" },
    });

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() =>
      expect(apiClient.getGuardians).toHaveBeenCalledWith(
        expect.objectContaining({ search: "maria" }),
        expect.any(Object),
      ),
    );

    fireEvent.change(screen.getByLabelText(/assign guardian/i), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: /register infant/i }));

    await waitFor(() =>
      expect(infantService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: "Jamie",
          last_name: "Doe",
          dob: "2026-05-20",
          sex: "female",
          guardian_id: "12",
          blood_type: "",
        }),
      ),
    );
  });
});
