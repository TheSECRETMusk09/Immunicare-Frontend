import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthProvider } from "../contexts/AuthContext";
import Dashboard from "./Dashboard/DashboardOverview";

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

describe("Dark Mode Functionality", () => {
  test("dark mode class is applied to the root element", () => {
    render(
      <AuthProvider>
        <Dashboard />
      </AuthProvider>,
    );

    // Initially, the dark class should not be applied
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    // Find the dark mode toggle button (it could be either 🌙 or ☀️)
    const darkModeToggle = screen.getByRole("button", {
      name: (content, element) => {
        return element.textContent === "🌙" || element.textContent === "☀️";
      },
    });

    // Click the toggle button
    fireEvent.click(darkModeToggle);

    // After clicking, the dark class should be applied
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // Click again to toggle back to light mode
    fireEvent.click(darkModeToggle);

    // The dark class should be removed
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
