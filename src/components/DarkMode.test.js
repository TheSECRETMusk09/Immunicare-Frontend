import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    logout: jest.fn(),
    user: {
      firstName: "Test",
      username: "admin.user",
      role: "admin",
      email: "admin@example.com",
    },
  }),
}));

describe("Admin sidebar dark mode control", () => {
  test("calls the provided toggle handler and reflects the current mode label", () => {
    const onToggleDarkMode = jest.fn();

    const { rerender } = render(
      <MemoryRouter initialEntries={["/analytics"]}>
        <Sidebar
          isOpen={true}
          onClose={jest.fn()}
          darkMode={false}
          onToggleDarkMode={onToggleDarkMode}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /dark mode/i }));
    expect(onToggleDarkMode).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter initialEntries={["/analytics"]}>
        <Sidebar
          isOpen={true}
          onClose={jest.fn()}
          darkMode={true}
          onToggleDarkMode={onToggleDarkMode}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /light mode/i })).toBeInTheDocument();
  });
});
