import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Input from "../UI/Input";

describe("Input Component", () => {
  test("renders with correct type when not showing password", () => {
    render(<Input label="Password" name="password" type="password" />);
    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("shows password when showPasswordToggle is true and password is shown", async () => {
    render(
      <Input
        label="Password"
        name="password"
        type="password"
        showPasswordToggle={true}
      />
    );
    const passwordInput = screen.getByLabelText("Password");
    const toggleButton = screen.getByRole("button", { hidden: true });

    fireEvent.click(toggleButton);

    // Wait for the input type to change to 'text'
    await waitFor(() => {
      expect(passwordInput).toHaveAttribute("type", "text");
    });
  });

  test("hides password when showPasswordToggle is true and password is hidden", async () => {
    render(
      <Input
        label="Password"
        name="password"
        type="password"
        showPasswordToggle={true}
      />
    );
    const passwordInput = screen.getByLabelText("Password");
    const toggleButton = screen.getByRole("button", { hidden: true });

    fireEvent.click(toggleButton);

    // Wait for the input type to change to 'text'
    await waitFor(() => {
      expect(passwordInput).toHaveAttribute("type", "text");
    });

    fireEvent.click(toggleButton);

    // Wait for the input type to change back to 'password'
    await waitFor(() => {
      expect(passwordInput).toHaveAttribute("type", "password");
    });
  });
});
