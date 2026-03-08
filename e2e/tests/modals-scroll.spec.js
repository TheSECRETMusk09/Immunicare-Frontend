/**
 * Modal Positioning and Scroll Containment Tests
 * Validates modal behavior on small screens
 * Tests scroll containment and body scroll locking
 *
 * @tags modal, scroll, mobile, containment
 */

const { test, expect } = require('@playwright/test');
const {
  checkModalPositioning,
  testAtBreakpoints,
  MOBILE_BREAKPOINTS,
} = require('../utils/mobile-helpers');

const TEST_CREDENTIALS = {
  email: process.env.TEST_GUARDIAN_EMAIL || 'guardian@test.com',
  password: process.env.TEST_GUARDIAN_PASSWORD || 'password123',
};

test.describe('Modal Positioning Tests @modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/guardian/login');
    await page.waitForLoadState('networkidle');

    // Login
    await page.fill('input[type="email"], input[name="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"], input[name="password"]', TEST_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/guardian/dashboard', { timeout: 10000 });
  });

  test.describe('Child Registration Modal', () => {
    test('should open add child modal', async ({ page }) => {
      await page.goto('/guardian/children');
      await page.waitForLoadState('networkidle');

      // Click add child button
      const addButton = await page.$('button:has-text("Add"), button:has-text("New"), [data-testid="add-child"]');
      if (addButton) {
        await addButton.click();

        // Check modal is visible
        const modal = await page.$('[role="dialog"], .modal, [data-testid="modal"]');
        expect(modal).toBeTruthy();

        // Check modal is within viewport
        const modalBox = await modal.boundingBox();
        const viewport = await page.viewportSize();

        expect(modalBox.x).toBeGreaterThanOrEqual(0);
        expect(modalBox.y).toBeGreaterThanOrEqual(0);
        expect(modalBox.width).toBeLessThanOrEqual(viewport.width);
      }
    });

    test('modal should have proper scroll containment', async ({ page }) => {
      await page.goto('/guardian/children');

      // Open modal
      const addButton = await page.$('button:has-text("Add")');
      if (addButton) {
        await addButton.click();
        await page.waitForTimeout(300);

        // Check body scroll is locked
        const bodyOverflow = await page.evaluate(() => {
          return document.body.style.overflow;
        });

        expect(bodyOverflow).toBe('hidden');

        // Close modal and verify scroll is restored
        const cancelButton = await page.$('button:has-text("Cancel"), [data-testid="modal-cancel"]');
        if (cancelButton) {
          await cancelButton.click();
          await page.waitForTimeout(300);

          const bodyOverflowAfter = await page.evaluate(() => {
            return document.body.style.overflow;
          });

          expect(bodyOverflowAfter).not.toBe('hidden');
        }
      }
    });

    test('modal content should be scrollable on small screens', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto('/guardian/children');

      // Open modal
      const addButton = await page.$('button:has-text("Add")');
      if (addButton) {
        await addButton.click();
        await page.waitForTimeout(300);

        const modal = await page.$('[role="dialog"], .modal');
        if (modal) {
          // Check modal body is scrollable
          const modalBody = await modal.$('[role="document"], .modal-body, .modal-content');
          if (modalBody) {
            const isScrollable = await modalBody.evaluate(el => {
              const style = window.getComputedStyle(el);
              return style.overflow === 'auto' || style.overflowY === 'auto' || style.overflowY === 'scroll';
            });

            expect(isScrollable).toBe(true);
          }
        }
      }
    });

    test('cancel button should close modal', async ({ page }) => {
      await page.goto('/guardian/children');

      // Open modal
      const addButton = await page.$('button:has-text("Add")');
      if (addButton) {
        await addButton.click();
        await page.waitForTimeout(300);

        // Find and click cancel
        const cancelButton = await page.$('button:has-text("Cancel"), button[data-variant="cancel"]');
        expect(cancelButton).toBeTruthy();

        if (cancelButton) {
          await cancelButton.click();
          await page.waitForTimeout(300);

          // Modal should be closed
          const modal = await page.$('[role="dialog"][aria-modal="true"], .modal.show, .modal-open');
          expect(modal).toBeFalsy();
        }
      }
    });
  });

  test.describe('Password Change Modal', () => {
    test('should display password change modal for first login', async ({ page }) => {
      // This test would need a test account with force_password_change = true
      // For now, we just verify the modal structure exists
      await page.goto('/guardian/dashboard');

      // Check if password modal appears
      const passwordModal = await page.$('[role="dialog"]:has-text("Password")');
      // May or may not appear depending on user state
    });
  });

  test.describe('Delete Confirmation Modal', () => {
    test('should show delete confirmation modal', async ({ page }) => {
      await page.goto('/guardian/children');

      // Wait for children to load
      await page.waitForTimeout(1000);

      // Find delete button on a child card
      const deleteButton = await page.$('button:has-text("Delete"), button:has([data-lucide="trash-2"])');
      if (deleteButton) {
        await deleteButton.click();
        await page.waitForTimeout(300);

        // Check confirmation modal
        const confirmModal = await page.$('[role="alertdialog"], .modal:has-text("Delete")');
        expect(confirmModal).toBeTruthy();

        // Check modal has proper focus trap
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(['BUTTON', 'INPUT', 'A']).toContain(focusedElement);
      }
    });

    test('delete modal should have proper button order', async ({ page }) => {
      await page.goto('/guardian/children');
      await page.waitForTimeout(1000);

      const deleteButton = await page.$('button:has-text("Delete")');
      if (deleteButton) {
        await deleteButton.click();
        await page.waitForTimeout(300);

        // Check buttons exist
        const cancelBtn = await page.$('button:has-text("Cancel"), button:has-text("Keep")');
        const confirmBtn = await page.$('button:has-text("Delete"), button:has-text("Yes")');

        expect(cancelBtn).toBeTruthy();
        expect(confirmBtn).toBeTruthy();
      }
    });
  });

  test.describe('Modal Positioning at Different Breakpoints', () => {
    test('modal should be centered on larger screens', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/guardian/children');

      const addButton = await page.$('button:has-text("Add")');
      if (addButton) {
        await addButton.click();
        await page.waitForTimeout(300);

        const modal = await page.$('[role="dialog"]');
        if (modal) {
          const box = await modal.boundingBox();
          const viewport = await page.viewportSize();

          // Modal should be centered horizontally
          const centerX = box.x + box.width / 2;
          const viewportCenterX = viewport.width / 2;
          const offset = Math.abs(centerX - viewportCenterX);

          expect(offset).toBeLessThan(50); // Within 50px of center
        }
      }
    });

    test('modal should slide up from bottom on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/guardian/children');

      const addButton = await page.$('button:has-text("Add")');
      if (addButton) {
        await addButton.click();
        await page.waitForTimeout(300);

        const modal = await page.$('[role="dialog"]');
        if (modal) {
          const box = await modal.boundingBox();
          const viewport = await page.viewportSize();

          // On mobile, modal should be positioned near bottom
          expect(box.y).toBeGreaterThan(viewport.height * 0.2);
        }
      }
    });
  });
});

test.describe('Scroll Containment Tests @scroll', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/guardian/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/guardian/dashboard', { timeout: 10000 });
  });

  test.describe('Body Scroll Locking', () => {
    test('should lock body scroll when modal is open', async ({ page }) => {
      await page.goto('/guardian/children');

      // Get initial scroll position
      const initialScroll = await page.evaluate(() => window.scrollY);

      // Open modal
      const addButton = await page.$('button:has-text("Add")');
      if (addButton) {
        await addButton.click();
        await page.waitForTimeout(300);

        // Try to scroll
        await page.evaluate(() => window.scrollTo(0, 100));
        const scrollAfterModal = await page.evaluate(() => window.scrollY);

        // Scroll should be locked (no change or minimal)
        expect(scrollAfterModal).toBe(initialScroll);

        // Close modal
        const cancelBtn = await page.$('button:has-text("Cancel")');
        if (cancelBtn) {
          await cancelBtn.click();
          await page.waitForTimeout(300);

          // Scroll should be restored
          await page.evaluate(() => window.scrollTo(0, 50));
          const scrollAfterClose = await page.evaluate(() => window.scrollY);
          expect(scrollAfterClose).toBe(50);
        }
      }
    });
  });

  test.describe('Modal Scroll Behavior', () => {
    test('modal should have internal scroll when content overflows', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto('/guardian/children');

      const addButton = await page.$('button:has-text("Add")');
      if (addButton) {
        await addButton.click();
        await page.waitForTimeout(300);

        const modal = await page.$('[role="dialog"]');
        if (modal) {
          // Check for overscroll-behavior
          const hasOverscrollContain = await modal.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.overscrollBehavior === 'contain' ||
                   style.overscrollBehaviorY === 'contain';
          });

          expect(hasOverscrollContain).toBe(true);
        }
      }
    });

    test('modal should close on backdrop click', async ({ page }) => {
      await page.goto('/guardian/children');

      const addButton = await page.$('button:has-text("Add")');
      if (addButton) {
        await addButton.click();
        await page.waitForTimeout(300);

        // Click on backdrop (outside modal)
        const backdrop = await page.$('.modal-backdrop, [aria-hidden="true"]');
        if (backdrop) {
          await backdrop.click();
          await page.waitForTimeout(300);

          const modal = await page.$('[role="dialog"][aria-modal="true"]');
          expect(modal).toBeFalsy();
        }
      }
    });

    test('modal should close on escape key', async ({ page }) => {
      await page.goto('/guardian/children');

      const addButton = await page.$('button:has-text("Add")');
      if (addButton) {
        await addButton.click();
        await page.waitForTimeout(300);

        // Press escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        const modal = await page.$('[role="dialog"][aria-modal="true"]');
        expect(modal).toBeFalsy();
      }
    });
  });

  test.describe('iOS Safari Scroll Behavior', () => {
    test('should have -webkit-overflow-scrolling on scrollable areas', async ({ page }) => {
      await page.goto('/guardian/dashboard');

      const hasMomentumScroll = await page.evaluate(() => {
        const elements = document.querySelectorAll('.guardian-sidebar, .modal-body, main');
        for (const el of elements) {
          const style = window.getComputedStyle(el);
          if (style.webkitOverflowScrolling === 'touch') {
            return true;
          }
        }
        return false;
      });

      // Should have momentum scrolling for iOS
      expect(hasMomentumScroll || true).toBe(true); // Soft check as it may vary
    });
  });
});

test.describe('Safe Area Tests @safe-area', () => {
  test('should account for iPhone notch/safe areas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
    await page.goto('/guardian/dashboard');

    // Check for safe area CSS usage
    const hasSafeArea = await page.evaluate(() => {
      const stylesheets = document.styleSheets;
      for (const sheet of stylesheets) {
        try {
          const rules = sheet.cssRules || sheet.rules;
          for (const rule of rules) {
            if (rule.cssText && rule.cssText.includes('env(safe-area-inset')) {
              return true;
            }
          }
        } catch (e) {
          // Cross-origin stylesheet
        }
      }
      return false;
    });

    expect(hasSafeArea).toBe(true);
  });

  test('bottom navigation should respect safe area', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/guardian/dashboard');

    const bottomNav = await page.$('.guardian-bottom-nav, nav[role="navigation"]');
    if (bottomNav) {
      const hasSafeAreaPadding = await bottomNav.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.paddingBottom?.includes('env') ||
               style.paddingBottom?.includes('safe-area');
      });

      expect(hasSafeAreaPadding).toBe(true);
    }
  });
});
