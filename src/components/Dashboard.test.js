import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Dashboard from "./Dashboard/DashboardOverview";
import { AuthProvider } from "../contexts/AuthContext";

// Mock the useDashboardStats and useDashboard hooks
jest.mock("../hooks/useDashboard", () => ({
  useDashboardStats: () => ({
    stats: {
      infants: 0,
      guardians: 0,
      appointments: 0,
      lowStock: 0,
    },
    loading: false,
  }),
  useDashboard: () => ({
    stats: {
      infants: 0,
      guardians: 0,
      appointments: 0,
      lowStock: 0,
    },
    analytics: {},
    loading: false,
    error: null,
  }),
}));

// Mock the useAuth hook
jest.mock("../contexts/AuthContext", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    isAuthenticated: true,
    isAdmin: true,
    isUser: false,
    user: { name: "Test User" },
    logout: jest.fn(),
  }),
}));

describe("Dashboard Component", () => {
  test("renders dark mode toggle button", () => {
    render(
      <AuthProvider>
        <Dashboard />
      </AuthProvider>,
    );

    const darkModeToggle = screen.getByRole("button", {
      name: /switch to dark mode/i,
    });
    expect(darkModeToggle).toBeInTheDocument();
  });

  test("toggles dark mode when button is clicked", () => {
    render(
      <AuthProvider>
        <Dashboard />
      </AuthProvider>,
    );

    const darkModeToggle = screen.getByRole("button", {
      name: /switch to dark mode/i,
    });
    fireEvent.click(darkModeToggle);

    // Check if the dark class is added to the dashboard container
    const dashboardContainer = screen.getByText((content, element) => {
      return element.classList?.contains("min-h-screen");
    });
    expect(dashboardContainer).toHaveClass("dark");

    // Check if the toggle button changed to light mode
    const lightModeToggle = screen.getByRole("button", {
      name: /switch to light mode/i,
    });
    expect(lightModeToggle).toBeInTheDocument();
  });
});
