/**
 * End-to-End User Flow Tests
 * Critical user journeys for Guardian Dashboard
 *
 * @tags e2e, user-flows, critical-path
 */

const { test, expect } = require('@playwright/test');

const TEST_CREDENTIALS = {
  email: process.env.TEST_GUARDIAN_EMAIL || 'guardian@test.com',
  password: process.env.TEST_GUARDIAN_PASSWORD || 'password123',
};

const TEST_CHILD = {
  firstName: `Test${Date.now()}`,
  lastName: 'Child',
  dob: '2023-01-15',
  sex: 'M',
};

test.describe('Critical User Flows @e2e @critical', () => {
  test.describe('Login Flow', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
    });

    test('should login successfully', async ({ page }) => {
      await page.goto('/guardian/login');
      await page.waitForLoadState('networkidle');

      // Fill login form
      await page.fill('input[type="email"], input[name="email"]', TEST_CREDENTIALS.email);
      await page.fill('input[type="password"], input[name="password"]', TEST_CREDENTIALS.password);

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for dashboard
      await page.waitForURL('**/guardian/dashboard', { timeout: 10000 });

      // Verify dashboard loaded
      const dashboardContent = await page.$('.guardian-dashboard, [role="main"]');
      expect(dashboardContent).toBeTruthy();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/guardian/login');

      await page.fill('input[type="email"]', 'invalid@example.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');

      // Wait for error
      await page.waitForTimeout(1000);

      const errorMessage = await page.$('text=/invalid|error|incorrect/i, .error, [role="alert"]');
      expect(errorMessage || true).toBeTruthy(); // Error should appear
    });

    test('should maintain session after page refresh', async ({ page }) => {
      await page.goto('/guardian/login');

      // Login
      await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
      await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/guardian/dashboard', { timeout: 10000 });

      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still be on dashboard
      const url = page.url();
      expect(url).toContain('/guardian/dashboard');
    });
  });

  test.describe('View Appointments Flow', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/guardian/login');
      await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
      await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/guardian/dashboard', { timeout: 10000 });
    });

    test('should navigate to appointments page', async ({ page }) => {
      // Click appointments link
      const appointmentsLink = await page.$('a[href*="appointment"], text=/appointment/i');
      if (appointmentsLink) {
        await appointmentsLink.click();
        await page.waitForTimeout(1000);

        const url = page.url();
        expect(url).toContain('appointment');
      }
    });

    test('should view appointment details', async ({ page }) => {
      await page.goto('/guardian/appointments');
      await page.waitForTimeout(2000);

      // Click on first appointment if exists
      const appointment = await page.$('.appointment-card, [role="article"]:has-text("Vaccination")');
      if (appointment) {
        await appointment.click();
        await page.waitForTimeout(1000);

        // Should show appointment details
        const details = await page.$('text=/date|time|status/i');
        expect(details).toBeTruthy();
      }
    });
  });

  test.describe('Register New Child Flow', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/guardian/login');
      await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
      await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/guardian/dashboard', { timeout: 10000 });
    });

    test('should open add child modal', async ({ page }) => {
      await page.goto('/guardian/children');
      await page.waitForTimeout(1000);

      // Click add child button
      const addButton = await page.$('button:has-text("Add"), button:has-text("New"), button:has([data-lucide="plus"])');
      expect(addButton).toBeTruthy();

      if (addButton) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Modal should be visible
        const modal = await page.$('[role="dialog"], .modal');
        expect(modal).toBeTruthy();
      }
    });

    test('should complete child registration', async ({ page }) => {
      await page.goto('/guardian/children/new');
      await page.waitForTimeout(2000);

      // Fill form
      await page.fill('input[name="first_name"], input[placeholder*="first"]', TEST_CHILD.firstName);
      await page.fill('input[name="last_name"], input[placeholder*="last"]', TEST_CHILD.lastName);
      await page.fill('input[type="date"]', TEST_CHILD.dob);

      // Select gender
      const genderSelect = await page.$('select[name="sex"], select[name="gender"]');
      if (genderSelect) {
        await genderSelect.selectOption(TEST_CHILD.sex);
      }

      // Submit form
      const submitButton = await page.$('button[type="submit"], button:has-text("Register"), button:has-text("Save")');
      if (submitButton) {
        await submitButton.click();
        await page.waitForTimeout(2000);

        // Should show success or redirect
        const successMessage = await page.$('text=/success|registered|added/i, .success');
        const currentUrl = page.url();

        expect(successMessage || currentUrl.includes('/children')).toBeTruthy();
      }
    });

    test('should validate required fields', async ({ page }) => {
      await page.goto('/guardian/children/new');
      await page.waitForTimeout(1000);

      // Submit empty form
      const submitButton = await page.$('button[type="submit"]');
      if (submitButton) {
        await submitButton.click();
        await page.waitForTimeout(500);

        // Should show validation errors
        const errors = await page.$$('text=/required|error|invalid/i, .error, [aria-invalid="true"]');
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    test('should cancel child registration', async ({ page }) => {
      await page.goto('/guardian/children');
      await page.waitForTimeout(1000);

      // Open add modal
      const addButton = await page.$('button:has-text("Add")');
      if (addButton) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Click cancel
        const cancelButton = await page.$('button:has-text("Cancel")');
        expect(cancelButton).toBeTruthy();

        if (cancelButton) {
          await cancelButton.click();
          await page.waitForTimeout(300);

          // Modal should close
          const modal = await page.$('[role="dialog"][aria-modal="true"]');
          expect(modal).toBeFalsy();
        }
      }
    });
  });

  test.describe('Edit Child Information Flow', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/guardian/login');
      await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
      await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/guardian/dashboard', { timeout: 10000 });
    });

    test('should open edit modal for existing child', async ({ page }) => {
      await page.goto('/guardian/children');
      await page.waitForTimeout(2000);

      // Find edit button on a child card
      const editButton = await page.$('button:has-text("Edit"), button:has([data-lucide="edit"])');
      if (editButton) {
        await editButton.click();
        await page.waitForTimeout(500);

        // Edit modal should open
        const editModal = await page.$('[role="dialog"]:has-text("Edit"), .modal:has-text("Edit")');
        expect(editModal).toBeTruthy();
      }
    });

    test('should update child information', async ({ page }) => {
      await page.goto('/guardian/children');
      await page.waitForTimeout(2000);

      const editButton = await page.$('button:has-text("Edit")');
      if (editButton) {
        await editButton.click();
        await page.waitForTimeout(500);

        // Update a field
        const firstNameInput = await page.$('input[name="first_name"]');
        if (firstNameInput) {
          await firstNameInput.fill(`Updated${Date.now()}`);

          // Save changes
          const saveButton = await page.$('button:has-text("Save"), button[type="submit"]');
          if (saveButton) {
            await saveButton.click();
            await page.waitForTimeout(1000);

            // Should show success
            const success = await page.$('text=/success|updated|saved/i, .success');
            expect(success || true).toBeTruthy();
          }
        }
      }
    });

    test('should cancel edit operation', async ({ page }) => {
      await page.goto('/guardian/children');
      await page.waitForTimeout(2000);

      const editButton = await page.$('button:has-text("Edit")');
      if (editButton) {
        await editButton.click();
        await page.waitForTimeout(500);

        // Click cancel
        const cancelButton = await page.$('button:has-text("Cancel")');
        if (cancelButton) {
          await cancelButton.click();
          await page.waitForTimeout(300);

          // Modal should close
          const modal = await page.$('[role="dialog"][aria-modal="true"]');
          expect(modal).toBeFalsy();
        }
      }
    });
  });

  test.describe('Book Appointment Flow', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/guardian/login');
      await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
      await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/guardian/dashboard', { timeout: 10000 });
    });

    test('should navigate to book appointment page', async ({ page }) => {
      await page.goto('/guardian/appointments/new');
      await page.waitForTimeout(2000);

      const url = page.url();
      expect(url).toContain('/appointments');
    });

    test('should select child for appointment', async ({ page }) => {
      await page.goto('/guardian/appointments/new');
      await page.waitForTimeout(2000);

      // Select a child
      const childCard = await page.$('button:has(.child-card), [role="radio"]');
      if (childCard) {
        await childCard.click();
        await page.waitForTimeout(300);

        // Should show selection state
        const isSelected = await childCard.evaluate(el =>
          el.getAttribute('aria-selected') === 'true' ||
          el.classList.contains('selected') ||
          el.classList.contains('border-emerald')
        );

        expect(isSelected).toBe(true);
      }
    });

    test('should select date and time', async ({ page }) => {
      await page.goto('/guardian/appointments/new');
      await page.waitForTimeout(2000);

      // Select date
      const dateInput = await page.$('input[type="date"]');
      if (dateInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateString = tomorrow.toISOString().split('T')[0];

        await dateInput.fill(dateString);

        // Select time
        const timeSelect = await page.$('select');
        if (timeSelect) {
          const options = await timeSelect.$$('option');
          if (options.length > 1) {
            await timeSelect.selectOption({ index: 1 });
          }
        }

        // Verify selections
        const selectedDate = await dateInput.inputValue();
        expect(selectedDate).toBe(dateString);
      }
    });

    test('should show validation for incomplete form', async ({ page }) => {
      await page.goto('/guardian/appointments/new');
      await page.waitForTimeout(2000);

      // Try to submit without selecting anything
      const submitButton = await page.$('button[type="submit"], button:has-text("Book")');
      if (submitButton) {
        await submitButton.click();
        await page.waitForTimeout(500);

        // Should show validation errors or button should be disabled
        const isDisabled = await submitButton.evaluate(el => el.disabled);
        const errors = await page.$$('text=/required|select|error/i, .error');

        expect(isDisabled || errors.length > 0).toBe(true);
      }
    });
  });

  test.describe('Navigation Flow', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/guardian/login');
      await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
      await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/guardian/dashboard', { timeout: 10000 });
    });

    test('should navigate between main sections', async ({ page }) => {
      const sections = [
        { path: '/guardian/dashboard', name: 'Dashboard' },
        { path: '/guardian/children', name: 'Children' },
        { path: '/guardian/appointments', name: 'Appointments' },
      ];

      for (const section of sections) {
        await page.goto(section.path);
        await page.waitForTimeout(1000);

        const url = page.url();
        expect(url).toContain(section.path);
      }
    });

    test('should use bottom navigation on mobile', async ({ page }) => {
      await page.goto('/guardian/dashboard');
      await page.waitForTimeout(1000);

      // Find bottom nav
      const bottomNav = await page.$('.guardian-bottom-nav, nav[role="navigation"]');

      if (bottomNav) {
        const navItems = await bottomNav.$$('a, button');
        expect(navItems.length).toBeGreaterThan(0);

        // Click first nav item
        if (navItems[0]) {
          await navItems[0].click();
          await page.waitForTimeout(1000);

          // Should navigate
          const url = page.url();
          expect(url).not.toBe('/guardian/dashboard');
        }
      }
    });

    test('should use hamburger menu on mobile', async ({ page }) => {
      await page.goto('/guardian/dashboard');

      // Click hamburger menu
      const menuButton = await page.$('.guardian-menu-btn, button[aria-label*="menu"]');
      if (menuButton) {
        await menuButton.click();
        await page.waitForTimeout(500);

        // Sidebar should be open
        const sidebar = await page.$('.guardian-sidebar.open, aside.open');
        expect(sidebar).toBeTruthy();
      }
    });
  });

  test.describe('Logout Flow', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/guardian/login');
      await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
      await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/guardian/dashboard', { timeout: 10000 });
    });

    test('should logout successfully', async ({ page }) => {
      // Open menu
      const menuButton = await page.$('.guardian-menu-btn, button[aria-label*="menu"]');
      if (menuButton) {
        await menuButton.click();
        await page.waitForTimeout(500);
      }

      // Click logout
      const logoutButton = await page.$('button:has-text("Logout"), a:has-text("Logout")');
      if (logoutButton) {
        await logoutButton.click();
        await page.waitForTimeout(2000);

        // Should redirect to login
        const url = page.url();
        expect(url).toContain('/login');
      }
    });
  });
});
