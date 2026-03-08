import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import Reports from "../pages/Reports";
import apiClient from "../utils/api";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    request: jest.fn(),
    customRequest: jest.fn(),
  },
}));

jest.mock("../components/UI", () => {
  const React = require("react");

  const Select = ({ name, value, onChange, children, disabled, error }) => (
    <div>
      <select
        data-testid={`select-${name}`}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
      >
        {children}
      </select>
      {error ? <span>{error}</span> : null}
    </div>
  );

  const Input = ({ name, value, onChange, type = "text", disabled, error, min, max }) => (
    <div>
      <input
        data-testid={`input-${name}`}
        name={name}
        value={value}
        onChange={onChange}
        type={type}
        disabled={disabled}
        min={min}
        max={max}
      />
      {error ? <span>{error}</span> : null}
    </div>
  );

  const Button = ({ children, onClick, disabled, loading, type, form, title, variant, size }) => (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled || Boolean(loading)}
      form={form}
      title={title}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  );

  const DataTable = ({ columns, data }) => (
    <table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            {columns.map((column) => (
              <td key={`${row.id}-${column.key}`}>
                {column.render ? column.render(row[column.key], row) : row[column.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const Modal = ({ isOpen, title, children, footer, onClose }) =>
    isOpen ? (
      <div role="dialog" aria-label={title || "modal"}>
        <h2>{title}</h2>
        <button onClick={onClose}>Close Modal</button>
        {children}
        {footer}
      </div>
    ) : null;

  return {
    AdminModalActions: ({ children }) => <div>{children}</div>,
    Card: ({ title, children }) => (
      <section>
        {title ? <h3>{title}</h3> : null}
        {children}
      </section>
    ),
    Button,
    DataTable,
    Modal,
    Select,
    Input,
    Badge: ({ children }) => <span>{children}</span>,
    Alert: ({ children }) => <div role="alert">{children}</div>,
    PageHeader: ({ title, actions }) => (
      <header>
        <h1>{title}</h1>
        {actions}
      </header>
    ),
  };
});

describe("Reports page backend contract alignment", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeAll(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: jest.fn(() => "blob:reports-download"),
    });

    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });

  afterAll(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });

    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    apiClient.request.mockImplementation((endpoint, options = {}) => {
      if (endpoint === "/reports" && !options.method) {
        return Promise.resolve({ success: true, data: [] });
      }

      if (endpoint === "/reports/templates") {
        return Promise.resolve({
          success: true,
          data: [
            {
              type: "vaccination",
              name: "Vaccination Report",
              description: "Vaccination module export",
              availableFormats: ["pdf", "excel", "csv", "json"],
            },
          ],
        });
      }

      if (endpoint === "/reports/admin/summary") {
        return Promise.resolve({
          success: true,
          data: {
            vaccination: { total: 0, completed: 0 },
            inventory: { total_items: 0, low_stock_items: 0 },
            appointments: { total: 0, completed: 0 },
            guardians: { total: 0, active: 0 },
            infants: { total: 0, up_to_date: 0 },
            reports: { total_reports: 0, total_downloads: 0 },
          },
        });
      }

      if (endpoint === "/reports/generate" && options.method === "POST") {
        return Promise.resolve({
          success: true,
          data: {
            id: 101,
            type: options.data.type,
            title: "Vaccination Report",
            file_format: options.data.format,
            date_generated: "2026-03-08T00:00:00.000Z",
            file_size: 2048,
            download_count: 0,
            status: "completed",
          },
        });
      }

      if (String(endpoint).startsWith("/reports/") && options.method === "DELETE") {
        return Promise.resolve({ success: true });
      }

      return Promise.resolve({ success: true, data: [] });
    });
  });

  test("format dropdown excludes JSON and report generation payload keeps canonical format", async () => {
    render(<Reports />);

    await screen.findByRole("heading", { name: /reports management/i });

    fireEvent.click(screen.getAllByRole("button", { name: /\+ generate new report/i })[0]);

    const modal = await screen.findByRole("dialog", { name: /generate new report/i });
    const formatSelect = within(modal).getByTestId("select-format");
    const formatOptions = within(formatSelect)
      .getAllByRole("option")
      .map((option) => option.value);

    expect(formatOptions).toContain("pdf");
    expect(formatOptions).toContain("excel");
    expect(formatOptions).toContain("csv");
    expect(formatOptions).not.toContain("json");

    fireEvent.change(within(modal).getByTestId("select-type"), {
      target: { name: "type", value: "vaccination" },
    });
    fireEvent.change(formatSelect, {
      target: { name: "format", value: "excel" },
    });

    fireEvent.click(within(modal).getByRole("button", { name: /generate report/i }));

    await waitFor(() => {
      expect(apiClient.request).toHaveBeenCalledWith(
        "/reports/generate",
        expect.objectContaining({
          method: "POST",
          data: expect.objectContaining({
            type: "vaccination",
            format: "excel",
          }),
        }),
      );
    });
  });

  test("displays backend empty-dataset error message from response payload", async () => {
    apiClient.request.mockImplementation((endpoint, options = {}) => {
      if (endpoint === "/reports" && !options.method) {
        return Promise.resolve({ success: true, data: [] });
      }

      if (endpoint === "/reports/templates") {
        return Promise.resolve({
          success: true,
          data: [{ type: "vaccination", name: "Vaccination Report", availableFormats: ["csv"] }],
        });
      }

      if (endpoint === "/reports/admin/summary") {
        return Promise.resolve({ success: true, data: { vaccination: {} } });
      }

      if (endpoint === "/reports/generate" && options.method === "POST") {
        const error = new Error("HTTP error");
        error.response = {
          data: {
            message:
              "No data found for selected filters. Please adjust filter criteria and try again.",
            error: "REPORT_EMPTY_DATASET",
          },
        };
        return Promise.reject(error);
      }

      return Promise.resolve({ success: true, data: [] });
    });

    render(<Reports />);

    await screen.findByRole("heading", { name: /reports management/i });

    fireEvent.click(screen.getAllByRole("button", { name: /\+ generate new report/i })[0]);

    const modal = await screen.findByRole("dialog", { name: /generate new report/i });
    fireEvent.click(within(modal).getByRole("button", { name: /generate report/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no data found for selected filters/i,
    );
  });

  test("downloads using customRequest and Content-Disposition filename", async () => {
    apiClient.request.mockImplementation((endpoint, options = {}) => {
      if (endpoint === "/reports" && !options.method) {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: 20,
              type: "vaccination",
              title: "Vaccination Report",
              file_format: "csv",
              date_generated: "2026-03-08T00:00:00.000Z",
              file_size: 1024,
              download_count: 0,
              status: "completed",
            },
          ],
        });
      }

      if (endpoint === "/reports/templates") {
        return Promise.resolve({ success: true, data: [] });
      }

      if (endpoint === "/reports/admin/summary") {
        return Promise.resolve({ success: true, data: {} });
      }

      return Promise.resolve({ success: true, data: [] });
    });

    const linkClickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    apiClient.customRequest.mockResolvedValue({
      data: new Blob(["id,name\n1,Sample"], { type: "text/csv" }),
      headers: {
        "content-disposition":
          'attachment; filename="vaccination-report-2026-03-08-00-00-00.csv"',
      },
    });

    render(<Reports />);

    const downloadButton = await screen.findByTitle(/download report/i);

    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(apiClient.customRequest).toHaveBeenCalledWith(
        "/reports/20/download",
        expect.objectContaining({
          method: "GET",
          responseType: "blob",
        }),
      );
    });

    expect(linkClickSpy).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();

    linkClickSpy.mockRestore();
  });
});
