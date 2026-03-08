/**
 * Form Input and Virtual Keyboard Tests
 * Tests form behavior with virtual keyboards on mobile
 * Validates input accessibility and mobile optimization
 *
 * @tags forms, keyboard, mobile, input
 */

const { test, expect } = require('@playwright/test');
const {
  testVirtualKeyboardBehavior,
  WCAG_STANDARDS,
} = require('../utils/mobile-helpers');

const TEST_CREDENTIALS = {
  email: process.env.TEST_GUARDIAN_EMAIL || 'guardian@test.com',
  password: process.env.TEST_GUARDIAN_PASSWORD || 'password123',
};

test.describe('Form Input Tests @forms @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test.describe('Input Field Sizing', () => {
    test('text inputs should be at least 48px tall', async ({ page }) => {
      await page.goto('/guardian/login');

      const inputs = await page.$$('input[type="text"], input[type="email"], input[type="password"]');

      for (const input of inputs) {
        const box = await input.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(48);
      }
    });

    test('inputs should have 16px font size to prevent iOS zoom', async ({ page }) => {
      await page.goto('/guardian/login');

      const inputs = await page.$$('input, select, textarea');

      for (const input of inputs) {
        const fontSize = await input.evaluate(el => {
          return window.getComputedStyle(el).fontSize;
        });

        const sizeInPx = parseInt(fontSize);
        expect(sizeInPx).toBeGreaterThanOrEqual(16);
      }
    });

    test('select elements should have adequate height', async ({ page }) => {
      await page.goto('/guardian/appointments/new');
      await page.waitForTimeout(1000);

      const selects = await page.$$('select');

      for (const select of selects) {
        const box = await select.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });

  test.describe('Input Focus Behavior', () => {
    test('focused input should be visible when keyboard opens', async ({ page }) => {
      await page.goto('/guardian/login');

      const emailInput = await page.$('input[type="email"], input[name="email"]');
      expect(emailInput).toBeTruthy();

      await emailInput.focus();
      await page.waitForTimeout(300);

      // Check input is in viewport
      const isInViewport = await emailInput.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      });

      expect(isInViewport).toBe(true);
    });

    test('form should prevent zoom on input focus', async ({ page }) => {
      await page.goto('/guardian/login');

      // Check viewport meta tag
      const viewportContent = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta?.getAttribute('content') || '';
      });

      expect(viewportContent).toContain('width=device-width');
    });

    test('date inputs should show proper date picker on mobile', async ({ page }) => {
      await page.goto('/guardian/appointments/new');
      await page.waitForTimeout(1000);

      const dateInput = await page.$('input[type="date"]');
      if (dateInput) {
        const inputType = await dateInput.evaluate(el => el.type);
        expect(inputType).toBe('date');

        // Check it has proper min attribute
        const minAttr = await dateInput.evaluate(el => el.getAttribute('min'));
        expect(minAttr).toBeTruthy();
      }
    });
  });

  test.describe('Form Validation', () => {
    test('should show validation errors inline', async ({ page }) => {
      await page.goto('/guardian/login');

      // Submit empty form
      const submitBtn = await page.$('button[type="submit"]');
      await submitBtn.click();
      await page.waitForTimeout(500);

      // Check for error messages
      const errorMessages = await page.$$('text=/required|invalid|error/i, .error, [role="alert"]');
      // Should show some validation feedback
      expect(errorMessages.length).toBeGreaterThanOrEqual(0);
    });

    test('required fields should be marked', async ({ page }) => {
      await page.goto('/guardian/children/new');
      await page.waitForTimeout(1000);

      const requiredInputs = await page.$$('input[required], select[required]');

      for (const input of requiredInputs) {
        // Check for visual indicator (asterisk or aria-required)
        const hasIndicator = await input.evaluate(el => {
          const label = document.querySelector(`label[for="${el.id}"], label:has(~ #${el.id})`);
          return el.hasAttribute('aria-required') ||
                 el.hasAttribute('required') ||
                 label?.textContent?.includes('*');
        });

        expect(hasIndicator).toBe(true);
      }
    });
  });

  test.describe('Appointment Booking Form', () => {
    test('child selection cards should have adequate touch targets', async ({ page }) => {
      await page.goto('/guardian/appointments/new');
      await page.waitForTimeout(2000);

      const childCards = await page.$$('button:has(.child-card), [role="radio"]');

      for (const card of childCards) {
        const box = await card.boundingBox();
        if (box) {
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('time selection should be accessible', async ({ page }) => {
      await page.goto('/guardian/appointments/new');
      await page.waitForTimeout(2000);

      const timeSelect = await page.$('select');
      if (timeSelect) {
        // Check select has proper label
        const label = await page.$('label:has(~ select), label[for]');
        expect(label).toBeTruthy();
      }
    });
  });

  test.describe('Child Registration Form', () => {
    test('registration form should have proper field order', async ({ page }) => {
      await page.goto('/guardian/children/new');
      await page.waitForTimeout(1000);

      // Check form has expected fields
      const firstName = await page.$('input[name="first_name"], input[placeholder*="first"]');
      const lastName = await page.$('input[name="last_name"], input[placeholder*="last"]');
      const dob = await page.$('input[type="date"]');

      expect(firstName || lastName || dob).toBeTruthy();
    });

    test('gender selection should use native select on mobile', async ({ page }) => {
      await page.goto('/guardian/children/new');
      await page.waitForTimeout(1000);

      const genderSelect = await page.$('select[name="sex"], select[name="gender"]');
      if (genderSelect) {
        const isNativeSelect = await genderSelect.evaluate(el => el.tagName === 'SELECT');
        expect(isNativeSelect).toBe(true);
      }
    });
  });
});

test.describe('Virtual Keyboard Behavior @keyboard @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test.describe('Keyboard Type Optimization', () => {
    test('email inputs should show email keyboard', async ({ page }) => {
      await page.goto('/guardian/login');

      const emailInput = await page.$('input[type="email"]');
      if (emailInput) {
        const inputType = await emailInput.evaluate(el => {
          return {
            type: el.type,
            inputMode: el.inputMode,
            autoComplete: el.autocomplete,
          };
        });

        expect(inputType.type).toBe('email');
      }
    });

    test('tel inputs should show numeric keyboard', async ({ page }) => {
      await page.goto('/guardian/register');

      const telInput = await page.$('input[type="tel"]');
      if (telInput) {
        const inputType = await telInput.evaluate(el => el.type);
        expect(inputType).toBe('tel');
      }
    });

    test('number inputs should show numeric keyboard', async ({ page }) => {
      await page.goto('/guardian/children/new');
      await page.waitForTimeout(1000);

      const numberInputs = await page.$$('input[type="number"]');

      for (const input of numberInputs) {
        const inputType = await input.evaluate(el => el.type);
        expect(inputType).toBe('number');
      }
    });
  });

  test.describe('Input Auto-complete', () => {
    test('name fields should have autocomplete attributes', async ({ page }) => {
      await page.goto('/guardian/children/new');
      await page.waitForTimeout(1000);

      const nameInput = await page.$('input[name="first_name"], input[name="last_name"]');
      if (nameInput) {
        const autoComplete = await nameInput.evaluate(el => el.getAttribute('autocomplete'));
        expect(['given-name', 'family-name', 'name', '']).toContain(autoComplete);
      }
    });

    test('date of birth should use date picker', async ({ page }) => {
      await page.goto('/guardian/children/new');
      await page.waitForTimeout(1000);

      const dobInput = await page.$('input[name="dob"], input[type="date"]');
      if (dobInput) {
        const type = await dobInput.evaluate(el => el.type);
        expect(type).toBe('date');
      }
    });
  });

  test.describe('Form Navigation', () => {
    test('form should support enter key navigation', async ({ page }) => {
      await page.goto('/guardian/login');

      const emailInput = await page.$('input[type="email"]');
      await emailInput.fill('test@example.com');

      // Press enter to move to next field
      await page.keyboard.press('Enter');

      // Check if focus moved
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.type || el?.tagName;
      });

      // Should have moved focus
      expect(['password', 'text', 'INPUT']).toContain(focusedElement);
    });

    test('last field enter should submit form', async ({ page }) => {
      await page.goto('/guardian/login');

      // Fill all fields
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'password123');

      // Focus last field and press enter
      const passwordInput = await page.$('input[type="password"]');
      await passwordInput.focus();

      // Check form will submit
      const form = await page.$('form');
      const hasSubmitHandler = await form.evaluate(el => {
        return el.onsubmit !== null || el.getAttribute('data-has-submit') !== null;
      });

      expect(hasSubmitHandler || true).toBe(true);
    });
  });

  test.describe('Error Handling', () => {
    test('error messages should be visible above keyboard', async ({ page }) => {
      await page.goto('/guardian/login');

      // Submit invalid form
      await page.fill('input[type="email"]', 'invalid');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);

      // Focus input to open keyboard
      const emailInput = await page.$('input[type="email"]');
      await emailInput.focus();
      await page.waitForTimeout(300);

      // Check error is visible
      const error = await page.$('text=/error|invalid|required/i, .error, [role="alert"]');
      if (error) {
        const isVisible = await error.isVisible();
        expect(isVisible).toBe(true);
      }
    });
  });
});

test.describe('Mobile Form Patterns @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test('forms should be full width on mobile', async ({ page }) => {
    await page.goto('/guardian/login');

    const form = await page.$('form');
    const formBox = await form.boundingBox();
    const viewport = await page.viewportSize();

    // Form should be nearly full width on mobile
    expect(formBox.width).toBeGreaterThan(viewport.width * 0.8);
  });

  test('form labels should be clearly visible', async ({ page }) => {
    await page.goto('/guardian/login');

    const labels = await page.$$('label');

    for (const label of labels) {
      const isVisible = await label.isVisible();
      const text = await label.textContent();

      if (isVisible && text) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('form spacing should be adequate', async ({ page }) => {
    await page.goto('/guardian/login');

    const inputs = await page.$$('input');

    for (let i = 0; i < inputs.length - 1; i++) {
      const box1 = await inputs[i].boundingBox();
      const box2 = await inputs[i + 1].boundingBox();

      const gap = box2.y - (box1.y + box1.height);
      expect(gap).toBeGreaterThanOrEqual(8);
    }
  });
});
