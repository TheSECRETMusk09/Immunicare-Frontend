import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import GuardianSidebar from "../components/GuardianSidebar";

const mockNavigate = jest.fn();
const mockLogout = jest.fn();

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: "/guardian/dashboard" }),
  };
});

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      firstName: "Guardian",
      email: "guardian@example.com",
      username: "guardian",
    },
    guardianId: 1,
    logout: mockLogout,
  }),
}));

jest.mock("../contexts/ThemeContext", () => ({
  useTheme: () => ({
    darkMode: true,
    toggleDarkMode: jest.fn(),
  }),
}));

jest.mock("../contexts/SocketContext", () => ({
  useSocket: () => ({
    isConnected: false,
    on: jest.fn(),
    off: jest.fn(),
  }),
}));

jest.mock("../hooks/useCachedData", () => ({
  usePrefetchGuardian: () => ({
    prefetchGuardianData: jest.fn(),
  }),
  useGuardianStats: () => ({
    data: { childrenCount: 1 },
  }),
}));

jest.mock("../hooks/useGuardianNotifications", () => ({
  __esModule: true,
  default: () => ({ unreadCount: 0 }),
}));

describe("GuardianSidebar logout modal dark mode", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLogout.mockReset();
    mockLogout.mockResolvedValue(undefined);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ childrenCount: 1 }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderSidebar = () => {
    render(
      <MemoryRouter initialEntries={["/guardian/dashboard"]}>
        <GuardianSidebar isOpen onClose={jest.fn()} onToggle={jest.fn()} isDesktop={false} />
      </MemoryRouter>,
    );
  };

  test("renders dark-mode-safe logout dialog classes and readable controls", async () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: /guardian\s+guardian@example\.com/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveClass("dark:bg-black/70");

    const title = screen.getByRole("heading", { name: /confirm logout/i });
    expect(title).toHaveClass("dark:text-gray-100");

    expect(screen.getByText(/are you sure you want to log out\?/i)).toHaveClass(
      "dark:text-gray-300",
    );

    expect(screen.getByRole("button", { name: /cancel/i })).toHaveClass(
      "dark:bg-gray-700",
      "dark:text-gray-100",
      "dark:hover:bg-gray-600",
    );

    expect(screen.getByRole("button", { name: /^logout$/i })).toHaveClass(
      "dark:bg-red-500",
      "dark:hover:bg-red-600",
    );
  });

  test("shows logout validation feedback when logout request fails", async () => {
    mockLogout.mockRejectedValueOnce(new Error("Network down"));
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: /guardian\s+guardian@example\.com/i }));
    fireEvent.click(screen.getByRole("button", { name: /^logout$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/unable to logout right now\. please try again\./i),
      ).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^logout$/i })).toBeEnabled();
  });
});
