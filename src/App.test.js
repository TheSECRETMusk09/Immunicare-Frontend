import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App shell", () => {
  test("renders the public guardian introduction on the root route", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /welcome to immunicare/i }),
    ).toBeInTheDocument();
  });
});
