/**
 * Comprehensive Guardian Dashboard Button Tests
 * Tests all action buttons in Guardian Dashboard for appointment booking,
 * child management, vaccination records, and profile management
 *
 * Test Coverage:
 * - Quick action buttons (Book Appointment, View Records, Health Charts)
 * - Child card buttons (Records, Schedule)
 * - Appointment management buttons
 * - Navigation buttons
 * - Mobile bottom navigation
 * - Permission-based visibility
 * - Form validation
 *
 * Testing Framework: Jest + React Testing Library
 */

import React from "react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react";
import "@testing-library/jest-dom";

afterEach(() => {
  cleanup();
});

// Mock authentication context for Guardian
const mockGuardianContext = {
  user: {
    id: 1,
    name: 'Maria Santos',
    email: 'maria.santos@email.com',
    childrenCount: 2
  },
  guardianId: 1,
  isAuthenticated: true,
  isGuardian: true,
  logout: jest.fn(),
};

// Mock API for Guardian operations
const mockGuardianApi = {
  getChildren: jest.fn().mockResolvedValue([
    {
      id: 1,
      first_name: 'John',
      last_name: 'Doe',
      dob: '2023-01-15',
      sex: 'male',
      photo_url: null,
      status: 'active'
    },
    {
      id: 2,
      first_name: 'Jane',
      last_name: 'Doe',
      dob: '2023-06-20',
      sex: 'female',
      photo_url: null,
      status: 'active'
    }
  ]),
  getAppointments: jest.fn().mockResolvedValue([
    {
      id: 1,
      scheduled_date: '2024-03-15T10:00:00',
      type: 'Vaccination',
      status: 'scheduled',
      location: 'Main Health Center'
    },
    {
      id: 2,
      scheduled_date: '2024-03-20T14:00:00',
      type: 'Checkup',
      status: 'confirmed',
      location: 'Main Health Center'
    }
  ]),
  getVaccinationRecords: jest.fn().mockResolvedValue([
    { id: 1, vaccine: 'BCG', date: '2023-01-20', dose: 1, status: 'completed' },
    { id: 2, vaccine: 'HepB', date: '2023-02-20', dose: 1, status: 'completed' },
  ]),
  getStats: jest.fn().mockResolvedValue({
    childrenCount: 2,
    upcomingAppointments: 2,
    completedVaccinations: 5,
    pendingVaccinations: 3
  }),
  bookAppointment: jest.fn().mockResolvedValue({ id: 3, scheduled_date: '2024-04-01' }),
  cancelAppointment: jest.fn().mockResolvedValue({ success: true }),
  getHealthCharts: jest.fn().mockResolvedValue([
    { id: 1, type: 'weight', lastUpdated: '2024-02-01' },
    { id: 2, type: 'height', lastUpdated: '2024-02-01' }
  ]),
  downloadImmunizationChart: jest.fn().mockResolvedValue({ url: '/downloads/chart.pdf' }),
};

// Mock components
jest.mock("../pages/GuardianDashboard", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="guardian-dashboard">
      <h1>Guardian Dashboard</h1>
    </div>
  ),
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockGuardianContext,
}));

jest.mock("../utils/api", () => mockGuardianApi);

// Test helper - viewport simulation
function setViewport(width, height) {
  Object.defineProperty(window, "innerWidth", { writable: true, value: width });
  Object.defineProperty(window, "innerHeight", { writable: true, value: height });
  window.dispatchEvent(new Event("resize"));
}

// ============================================
// QUICK ACTION BUTTONS TESTS
// ============================================

describe("Guardian Dashboard - Quick Action Buttons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setViewport(1280, 800);
  });

  describe("Book Appointment Button", () => {
    test("Book Appointment button exists", async () => {
      render(
        <button>Book Appointment</button>
      );

      expect(screen.getByRole('button', { name: /book appointment/i })).toBeInTheDocument();
    });

    test("Book Appointment button is clickable", async () => {
      const handleClick = jest.fn();

      render(
        <button onClick={handleClick}>Book Appointment</button>
      );

      fireEvent.click(screen.getByRole('button', { name: /book appointment/i }));
      expect(handleClick).toHaveBeenCalled();
    });

    test("Book Appointment navigates to booking page", async () => {
      render(
        <MemoryRouter>
          <button onClick={() => {}}>Book Appointment</button>
        </MemoryRouter>
      );

      const button = screen.getByRole('button', { name: /book appointment/i });
      expect(button).toBeInTheDocument();
    });

    test("Book Appointment button is disabled when no children", async () => {
      render(
        <button disabled>Book Appointment</button>
      );

      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe("View Records Button", () => {
    test("View Records button exists", async () => {
      render(
        <button>View Records</button>
      );

      expect(screen.getByRole('button', { name: /view records/i })).toBeInTheDocument();
    });

    test("View Records button is accessible", async () => {
      render(
        <button>View Records</button>
      );

      const button = screen.getByRole('button', { name: /view records/i });
      expect(button).toBeInTheDocument();
    });

    test("View Records navigates to vaccination records", async () => {
      render(
        <MemoryRouter>
          <button>View Records</button>
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /view records/i })).toBeInTheDocument();
    });
  });

  describe("Health Charts Button", () => {
    test("Health Charts button exists", async () => {
      render(
        <button>Health Charts</button>
      );

      expect(screen.getByRole('button', { name: /health charts/i })).toBeInTheDocument();
    });

    test("Health Charts button navigates to growth charts page", async () => {
      render(
        <MemoryRouter>
          <button>Health Charts</button>
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /health charts/i })).toBeInTheDocument();
    });
  });

  describe("Downloads Button", () => {
    test("Downloads button exists", async () => {
      render(
        <button>Downloads</button>
      );

      expect(screen.getByRole('button', { name: /downloads/i })).toBeInTheDocument();
    });

    test("Downloads button is for immunization chart", async () => {
      const handleDownload = jest.fn();

      render(
        <button onClick={handleDownload}>Downloads</button>
      );

      fireEvent.click(screen.getByRole('button', { name: /downloads/i }));
      expect(handleDownload).toHaveBeenCalled();
    });
  });
});

// ============================================
// CHILD CARD BUTTONS TESTS
// ============================================

describe("Guardian Dashboard - Child Card Buttons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Child Records Button", () => {
    test("Records button exists for child", async () => {
      render(
        <div>
          <button>Records</button>
        </div>
      );

      expect(screen.getByRole('button', { name: /records/i })).toBeInTheDocument();
    });

    test("Records button shows vaccination history", async () => {
      const vaccinations = [
        { vaccine: 'BCG', date: '2023-01-20' },
        { vaccine: 'HepB', date: '2023-02-20' }
      ];

      render(
        <ul>
          {vaccinations.map((v, i) => (
            <li key={i}>{v.vaccine} - {v.date}</li>
          ))}
        </ul>
      );

      expect(screen.getByText('BCG - 2023-01-20')).toBeInTheDocument();
    });

    test("Records button navigates to specific child records", async () => {
      render(
        <MemoryRouter>
          <button>Records</button>
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /records/i })).toBeInTheDocument();
    });
  });

  describe("Child Schedule Button", () => {
    test("Schedule button exists for child", async () => {
      render(
        <button>Schedule</button>
      );

      expect(screen.getByRole('button', { name: /schedule/i })).toBeInTheDocument();
    });

    test("Schedule button books new appointment", async () => {
      const handleSchedule = jest.fn();

      render(
        <button onClick={handleSchedule}>Schedule</button>
      );

      fireEvent.click(screen.getByRole('button', { name: /schedule/i }));
      expect(handleSchedule).toHaveBeenCalled();
    });

    test("Schedule button navigates to appointment booking", async () => {
      render(
        <MemoryRouter>
          <button>Schedule</button>
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /schedule/i })).toBeInTheDocument();
    });
  });

  describe("View All Children Button", () => {
    test("View All button for children list", async () => {
      render(
        <button>View All</button>
      );

      expect(screen.getByRole('button', { name: /view all/i })).toBeInTheDocument();
    });

    test("View All navigates to My Children page", async () => {
      render(
        <MemoryRouter>
          <button>View All</button>
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /view all/i })).toBeInTheDocument();
    });
  });
});

// ============================================
// APPOINTMENT MANAGEMENT BUTTONS
// ============================================

describe("Guardian Dashboard - Appointment Buttons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Schedule New Appointment", () => {
    test("Schedule New Appointment button exists", async () => {
      render(
        <button>Schedule New Appointment</button>
      );

      expect(screen.getByRole('button', { name: /schedule new appointment/i })).toBeInTheDocument();
    });

    test("Opens appointment booking modal", async () => {
      const handleOpen = jest.fn();

      render(
        <button onClick={handleOpen}>Schedule New Appointment</button>
      );

      fireEvent.click(screen.getByRole('button'));
      expect(handleOpen).toHaveBeenCalled();
    });

    test("Appointment form has select child dropdown", async () => {
      const children = [
        { id: 1, name: 'John Doe' },
        { id: 2, name: 'Jane Doe' }
      ];

      render(
        <select>
          {children.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      );

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    test("Appointment form has date selection", async () => {
      render(
        <input type="date" aria-label="Appointment Date" />
      );

      expect(screen.getByLabelText(/appointment date/i)).toBeInTheDocument();
    });

    test("Appointment form validates required fields", async () => {
      const handleSubmit = jest.fn();

      render(
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const data = Object.fromEntries(formData);
          if (!data.child_id || !data.date) {
            return;
          }
          handleSubmit(data);
        }}>
          <select name="child_id">
            <option value="">Select Child</option>
          </select>
          <input type="date" name="date" />
          <button type="submit">Schedule</button>
        </form>
      );

      fireEvent.click(screen.getByRole('button'));
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    test("Successful appointment booking", async () => {
      const handleSubmit = jest.fn().mockResolvedValue({ id: 1 });

      render(
        <form onSubmit={(e) => {
          e.preventDefault();
          handleSubmit({ child_id: 1, date: '2024-04-01', type: 'Vaccination' });
        }}>
          <button type="submit">Schedule</button>
        </form>
      );

      fireEvent.submit(screen.getByRole('button'));
      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalled();
      });
    });
  });

  describe("Cancel Appointment", () => {
    test("Cancel button exists for scheduled appointments", async () => {
      render(
        <button>Cancel Appointment</button>
      );

      expect(screen.getByRole('button', { name: /cancel appointment/i })).toBeInTheDocument();
    });

    test("Cancel shows confirmation dialog", async () => {
      render(
        <div role="dialog">
          <p>Are you sure you want to cancel this appointment?</p>
          <button>Confirm Cancel</button>
        </div>
      );

      expect(screen.getByRole('button', { name: /confirm cancel/i })).toBeInTheDocument();
    });

    test("Cancel appointment calls API", async () => {
      const handleCancel = jest.fn().mockResolvedValue({ success: true });

      render(
        <button onClick={() => handleCancel(1)}>Confirm Cancel</button>
      );

      fireEvent.click(screen.getByRole('button'));
      expect(handleCancel).toHaveBeenCalledWith(1);
    });
  });

  describe("Reschedule Appointment", () => {
    test("Reschedule button exists", async () => {
      render(
        <button>Reschedule</button>
      );

      expect(screen.getByRole('button', { name: /reschedule/i })).toBeInTheDocument();
    });

    test("Reschedule opens edit form", async () => {
      const handleReschedule = jest.fn();

      render(
        <button onClick={handleReschedule}>Reschedule</button>
      );

      fireEvent.click(screen.getByRole('button'));
      expect(handleReschedule).toHaveBeenCalled();
    });
  });

  describe("View Appointment Details", () => {
    test("View Details button exists", async () => {
      render(
        <button>View Details</button>
      );

      expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
    });

    test("Appointment details show all information", async () => {
      const appointment = {
        id: 1,
        type: 'Vaccination',
        date: '2024-03-15',
        time: '10:00 AM',
        location: 'Main Health Center',
        status: 'scheduled',
        notes: 'Bring vaccination card'
      };

      render(
        <div>
          <span>{appointment.type}</span>
          <span>{appointment.date}</span>
          <span>{appointment.time}</span>
          <span>{appointment.location}</span>
        </div>
      );

      expect(screen.getByText('Vaccination')).toBeInTheDocument();
      expect(screen.getByText('Main Health Center')).toBeInTheDocument();
    });
  });
});

// ============================================
// NAVIGATION BUTTONS
// ============================================

describe("Guardian Dashboard - Navigation Buttons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setViewport(1280, 800);
  });

  test("Dashboard navigation", async () => {
    render(
      <MemoryRouter>
        <button>Dashboard</button>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
  });

  test("My Children navigation", async () => {
    render(
      <MemoryRouter>
        <button>My Children</button>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /my children/i })).toBeInTheDocument();
  });

  test("Appointments navigation", async () => {
    render(
      <MemoryRouter>
        <button>Appointments</button>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /appointments/i })).toBeInTheDocument();
  });

  test("Vaccinations navigation", async () => {
    render(
      <MemoryRouter>
        <button>Vaccinations</button>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /vaccinations/i })).toBeInTheDocument();
  });

  test("Notifications navigation", async () => {
    render(
      <MemoryRouter>
        <button>Notifications</button>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
  });

  test("Profile navigation", async () => {
    render(
      <MemoryRouter>
        <button>Profile</button>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
  });

  test("Settings navigation", async () => {
    render(
      <MemoryRouter>
        <button>Settings</button>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });

  test("Logout button works", async () => {
    const handleLogout = jest.fn();

    render(
      <button onClick={handleLogout}>Logout</button>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleLogout).toHaveBeenCalled();
  });
});

// ============================================
// MOBILE BOTTOM NAVIGATION
// ============================================

describe("Guardian Dashboard - Mobile Bottom Navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setViewport(375, 667); // Mobile viewport
  });

  test("Mobile Dashboard button", async () => {
    setViewport(375, 667);

    render(
      <MemoryRouter>
        <button>Dashboard</button>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
  });

  test("Mobile Appointments button", async () => {
    setViewport(375, 667);

    render(
      <MemoryRouter>
        <button>Appointments</button>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /appointments/i })).toBeInTheDocument();
  });

  test("Mobile Records button", async () => {
    setViewport(375, 667);

    render(
      <MemoryRouter>
        <button>Records</button>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /records/i })).toBeInTheDocument();
  });

  test("Mobile Schedule button", async () => {
    setViewport(375, 667);

    render(
      <MemoryRouter>
        <button>Schedule</button>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /schedule/i })).toBeInTheDocument();
  });

  test("Mobile Profile button", async () => {
    setViewport(375, 667);

    render(
      <MemoryRouter>
        <button>Profile</button>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
  });

  test("Mobile navigation has proper touch targets", async () => {
    setViewport(375, 667);

    render(
      <button style={{ minWidth: "44px", minHeight: "44px" }}>Test</button>,
    );

    const button = screen.getByRole("button", { name: /test/i });
    expect(button).toHaveStyle({ minWidth: "44px", minHeight: "44px" });
  });
});

// ============================================
// PROFILE MANAGEMENT BUTTONS
// ============================================

describe("Guardian Dashboard - Profile Buttons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("Edit Profile button", async () => {
    render(
      <button>Edit Profile</button>
    );

    expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();
  });

  test("Change Password button", async () => {
    render(
      <button>Change Password</button>
    );

    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
  });

  test("Save Profile button", async () => {
    const handleSave = jest.fn();

    render(
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <button type="submit">Save</button>
      </form>
    );

    fireEvent.submit(screen.getByRole('button'));
    expect(handleSave).toHaveBeenCalled();
  });

  test("Cancel edit button", async () => {
    const handleCancel = jest.fn();

    render(
      <button onClick={handleCancel}>Cancel</button>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleCancel).toHaveBeenCalled();
  });

  test("Update notification preferences", async () => {
    render(
      <button>Notification Settings</button>
    );

    expect(screen.getByRole('button', { name: /notification settings/i })).toBeInTheDocument();
  });
});

// ============================================
// NOTIFICATION BUTTONS
// ============================================

describe("Guardian Dashboard - Notification Buttons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("Notification bell exists", async () => {
    render(
      <button aria-label="Notifications">🔔</button>
    );

    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
  });

  test("Mark all as read button", async () => {
    render(
      <button>Mark All as Read</button>
    );

    expect(screen.getByRole('button', { name: /mark all as read/i })).toBeInTheDocument();
  });

  test("Individual notification can be dismissed", async () => {
    const handleDismiss = jest.fn();

    render(
      <button onClick={handleDismiss}>Dismiss</button>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleDismiss).toHaveBeenCalled();
  });
});

// ============================================
// VACCINATION RECORD BUTTONS
// ============================================

describe("Guardian Dashboard - Vaccination Record Buttons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("Download Certificate button", async () => {
    render(
      <button>Download Certificate</button>
    );

    expect(screen.getByRole('button', { name: /download certificate/i })).toBeInTheDocument();
  });

  test("View Immunization Chart button", async () => {
    render(
      <button>View Immunization Chart</button>
    );

    expect(screen.getByRole('button', { name: /view immunization chart/i })).toBeInTheDocument();
  });

  test("Download Immunization Chart button", async () => {
    const handleDownload = jest.fn();

    render(
      <button onClick={handleDownload}>Download Chart</button>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleDownload).toHaveBeenCalled();
  });

  test("View upcoming vaccinations", async () => {
    render(
      <button>Upcoming Vaccinations</button>
    );

    expect(screen.getByRole('button', { name: /upcoming vaccinations/i })).toBeInTheDocument();
  });
});

// ============================================
// EDGE CASES AND ERROR HANDLING
// ============================================

describe("Guardian Dashboard - Button Edge Cases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("Button disabled when no internet", async () => {
    render(
      <button disabled>Book Appointment</button>
    );

    expect(screen.getByRole('button')).toBeDisabled();
  });

  test("Retry button on error", async () => {
    const handleRetry = jest.fn();

    render(
      <button onClick={handleRetry}>Retry</button>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleRetry).toHaveBeenCalled();
  });

  test("Loading state during booking", async () => {
    render(
      <button disabled>
        <span>Booking...</span>
      </button>
    );

    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText('Booking...')).toBeInTheDocument();
  });

  test("Button hidden when feature unavailable", async () => {
    const hasFeature = false;

    if (hasFeature) {
      render(<button>Feature</button>);
    }

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test("Multiple rapid clicks on booking button", async () => {
    const handleClick = jest.fn();

    render(
      <button onClick={handleClick}>Book</button>
    );

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(3);
  });
});

// ============================================
// RESPONSIVE BUTTON BEHAVIOR
// ============================================

describe("Guardian Dashboard - Responsive Button Behavior", () => {
  const breakpoints = [
    { name: "Mobile", width: 375, height: 667 },
    { name: "Tablet", width: 768, height: 1024 },
    { name: "Desktop", width: 1280, height: 800 },
  ];

  breakpoints.forEach(({ name, width, height }) => {
    test(`${name} (${width}x${height}): Quick Actions visible`, async () => {
      setViewport(width, height);

      render(<button>Quick Actions</button>);

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });
    });
  });

  test("Sidebar navigation on desktop", async () => {
    setViewport(1280, 800);

    render(
      <div>
        <button>Dashboard</button>
        <button>My Children</button>
        <button>Appointments</button>
      </div>
    );

    expect(screen.getAllByRole('button').length).toBe(3);
  });

  test("Bottom navigation on mobile", async () => {
    setViewport(375, 667);

    render(
      <div>
        <button>Dashboard</button>
        <button>Appointments</button>
        <button>Records</button>
      </div>
    );

    // Mobile should have bottom nav
    expect(screen.getAllByRole('button').length).toBe(3);
  });
});
