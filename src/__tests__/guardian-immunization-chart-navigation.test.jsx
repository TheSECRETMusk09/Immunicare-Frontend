import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import GuardianImmunizationChart from "../components/GuardianImmunizationChart";

describe("GuardianImmunizationChart - View Full Chart navigation", () => {
  test("navigates to child-specific guardian route without hard reload fallback", () => {
    render(
      <MemoryRouter initialEntries={["/guardian/dashboard"]}>
        <Routes>
          <Route
            path="/guardian/dashboard"
            element={<GuardianImmunizationChart childId={42} />}
          />
          <Route
            path="/guardian/immunization-chart/:childId"
            element={<div>Reached Child Full Chart</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    const viewFullChartButton = screen.getByRole("button", {
      name: /view full immunization chart/i,
    });

    fireEvent.click(viewFullChartButton);

    expect(screen.getByText("Reached Child Full Chart")).toBeInTheDocument();
  });

  test("uses provided onViewFullChart callback when passed from parent", () => {
    const onViewFullChart = jest.fn();

    render(
      <MemoryRouter>
        <GuardianImmunizationChart childId={7} onViewFullChart={onViewFullChart} />
      </MemoryRouter>,
    );

    const viewFullChartButton = screen.getByRole("button", {
      name: /view full immunization chart/i,
    });

    fireEvent.click(viewFullChartButton);

    expect(onViewFullChart).toHaveBeenCalledTimes(1);
  });
});
