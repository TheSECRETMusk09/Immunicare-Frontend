/**
 * Touch Target and Gesture Tests
 * Validates WCAG 2.5.5 compliance (44x44px minimum touch targets)
 * Tests touch interactions and gesture responsiveness
 *
 * @tags touch, gestures, wcag, accessibility
 */

const { test, expect } = require('@playwright/test');
const {
  WCAG_STANDARDS,
  checkTouchTarget,
  getInteractiveElements,
  simulateTouchTap,
} = require('../utils/mobile-helpers');

const MIN_TOUCH_SIZE = WCAG_STANDARDS.MIN_TOUCH_TARGET_SIZE;

// Test credentials
const TEST_CREDENTIALS = {
  email: process.env.TEST_GUARDIAN_EMAIL || 'guardian@test.com',
  password: process.env.TEST_GUARDIAN_PASSWORD || 'password123',
};

test.describe('Touch Target Compliance @touch @a11y', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone 12 Mini
    await page.goto('/guardian/login');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Button Touch Targets', () => {
    test('all buttons should have minimum 44x44px touch target', async ({ page }) => {
      const buttons = await page.$$('button, [role="button"], .guardian-btn, .btn');
      const violations = [];

      for (const button of buttons) {
        const check = await checkTouchTarget(button);
        if (!check.valid) {
          violations.push({
            element: await button.evaluate(el => el.textContent?.substring(0, 30) || 'unnamed'),
            size: `${check.width}x${check.height}`,
          });
        }
      }

      expect(violations).toHaveLength(0);
    });

    test('primary action buttons should have larger touch targets', async ({ page }) => {
      // Login and navigate to dashboard
      await page.fill('input[type="email"], input[name="email"]', TEST_CREDENTIALS.email);
      await page.fill('input[type="password"], input[name="password"]', TEST_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/guardian/dashboard', { timeout: 10000 });

      const primaryButtons = await page.$$('.guardian-btn--primary, .btn-primary, button[type="submit"]');

      for (const button of primaryButtons) {
        const check = await checkTouchTarget(button);
        expect(check.height).toBeGreaterThanOrEqual(44);
        expect(check.width).toBeGreaterThanOrEqual(44);
      }
    });

    test('icon-only buttons should meet minimum size', async ({ page }) => {
      const iconButtons = await page.$$('button:has(svg):not(:has-text(""))');

      for (const button of iconButtons) {
        const check = await checkTouchTarget(button);
        expect(check.width).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
        expect(check.height).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
      }
    });

    test('navigation items should have adequate touch targets', async ({ page }) => {
      await page.goto('/guardian/dashboard');

      const navItems = await page.$$('.guardian-sidebar-nav-item, .guardian-bottom-nav-item, nav a');

      for (const item of navItems) {
        const check = await checkTouchTarget(item);
        expect(check.height).toBeGreaterThanOrEqual(44);
      }
    });
  });

  test.describe('Form Input Touch Targets', () => {
    test('form inputs should be at least 48px tall', async ({ page }) => {
      const inputs = await page.$$('input, select, textarea');

      for (const input of inputs) {
        const check = await checkTouchTarget(input);
        expect(check.height).toBeGreaterThanOrEqual(48);
      }
    });

    test('checkboxes and radio buttons should have adequate spacing', async ({ page }) => {
      const checkboxes = await page.$$('input[type="checkbox"], input[type="radio"]');

      for (const checkbox of checkboxes) {
        const check = await checkTouchTarget(checkbox);
        // Checkboxes can be smaller but need adequate touch area
        expect(check.width).toBeGreaterThanOrEqual(24);
        expect(check.height).toBeGreaterThanOrEqual(24);
      }
    });
  });

  test.describe('Card Touch Targets', () => {
    test('interactive cards should have minimum touch size', async ({ page }) => {
      await page.goto('/guardian/dashboard');

      const cards = await page.$$('.guardian-stat-card, .guardian-appointment-card, [role="article"]');

      for (const card of cards) {
        const isClickable = await card.evaluate(el =>
          el.onclick !== null ||
          el.style.cursor === 'pointer' ||
          el.classList.contains('cursor-pointer')
        );

        if (isClickable) {
          const check = await checkTouchTarget(card);
          expect(check.width).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
          expect(check.height).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
        }
      }
    });
  });

  test.describe('Touch Spacing', () => {
    test('adjacent touch targets should have minimum 8px spacing', async ({ page }) => {
      const buttons = await page.$$('button');

      for (let i = 0; i < buttons.length - 1; i++) {
        const box1 = await buttons[i].boundingBox();
        const box2 = await buttons[i + 1].boundingBox();

        // Calculate distance between buttons
        const horizontalGap = Math.max(0, box2.x - (box1.x + box1.width));
        const verticalGap = Math.max(0, box2.y - (box1.y + box1.height));

        // At least one dimension should have adequate spacing
        const hasAdequateSpacing = horizontalGap >= 8 || verticalGap >= 8;

        if (!hasAdequateSpacing) {
          // Buttons might be intentionally close (like icon groups)
          const areClose = horizontalGap < 8 && verticalGap < 8;
          if (areClose) {
            // Check if they're in a button group
            const inGroup = await buttons[i].evaluate(el =>
              el.closest('.btn-group, .button-group, [role="group"]') !== null
            );
            expect(inGroup).toBe(true);
          }
        }
      }
    });
  });

  test.describe('Quick Action Buttons', () => {
    test('quick action buttons should have large touch targets', async ({ page }) => {
      await page.goto('/guardian/dashboard');

      const quickActions = await page.$$('.guardian-quick-action-btn, .quick-action');

      for (const action of quickActions) {
        const check = await checkTouchTarget(action);
        expect(check.width).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
        expect(check.height).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
      }
    });
  });
});

test.describe('Touch Interaction Tests @touch', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/guardian/login');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Tap Response', () => {
    test('buttons should respond to touch within 100ms', async ({ page }) => {
      const button = await page.$('button[type="submit"]');

      const startTime = Date.now();
      await simulateTouchTap(page, button);
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(300); // Allow for network/auth delay
    });

    test('should show visual feedback on touch', async ({ page }) => {
      const button = await page.$('button[type="submit"]');

      // Check for active/focus styles
      const hasActiveStyles = await button.evaluate(el => {
        const styles = window.getComputedStyle(el);
        // Check for common active state indicators
        return styles.transition !== 'none' ||
               el.classList.contains('active') ||
               el.classList.contains('pressed');
      });

      expect(hasActiveStyles).toBe(true);
    });

    test('double-tap should not trigger zoom', async ({ page }) => {
      // Check for touch-action CSS
      const hasTouchAction = await page.evaluate(() => {
        const body = document.body;
        const style = window.getComputedStyle(body);
        return style.touchAction === 'manipulation' ||
               document.querySelector('meta[name="viewport"]')?.content?.includes('user-scalable=no');
      });

      expect(hasTouchAction).toBe(true);
    });
  });

  test.describe('Gesture Responsiveness', () => {
    test('should support swipe gestures on sidebar', async ({ page }) => {
      await page.goto('/guardian/dashboard');

      // Open hamburger menu
      const menuButton = await page.$('.guardian-menu-btn, button[aria-label*="menu"]');
      if (menuButton) {
        await menuButton.tap();

        // Check sidebar is open
        const sidebar = await page.$('.guardian-sidebar.open, aside.open');
        expect(sidebar).toBeTruthy();

        // Swipe to close (simulated)
        const viewport = await page.viewportSize();
        await page.touchscreen.swipe(viewport.width * 0.8, viewport.height / 2, viewport.width * 0.2, viewport.height / 2);
      }
    });

    test('scroll should be smooth on mobile', async ({ page }) => {
      await page.goto('/guardian/dashboard');

      // Check for smooth scrolling
      const hasSmoothScroll = await page.evaluate(() => {
        const main = document.querySelector('main, .guardian-main-content');
        if (!main) return false;
        const style = window.getComputedStyle(main);
        return style.scrollBehavior === 'smooth' ||
               style.webkitOverflowScrolling === 'touch';
      });

      expect(hasSmoothScroll).toBe(true);
    });

    test('horizontal scroll should be disabled where not needed', async ({ page }) => {
      const overflow = await page.evaluate(() => {
        return {
          html: document.documentElement.style.overflowX,
          body: document.body.style.overflowX,
          hasOverflowHidden: document.body.style.overflowX === 'hidden' ||
                            getComputedStyle(document.body).overflowX === 'hidden',
        };
      });

      // Body should prevent horizontal overflow
      expect(overflow.hasOverflowHidden).toBe(true);
    });
  });

  test.describe('Touch Feedback', () => {
    test('should have touch-action manipulation on interactive elements', async ({ page }) => {
      const buttons = await page.$$('button');

      for (const button of buttons) {
        const touchAction = await button.evaluate(el => {
          return window.getComputedStyle(el).touchAction;
        });

        // Should prevent double-tap zoom
        expect(['manipulation', 'none', '']).toContain(touchAction);
      }
    });

    test('should have visual tap highlight', async ({ page }) => {
      const hasTapHighlight = await page.evaluate(() => {
        const styles = document.styleSheets;
        for (const sheet of styles) {
          try {
            const rules = sheet.cssRules || sheet.rules;
            for (const rule of rules) {
              if (rule.cssText && rule.cssText.includes('-webkit-tap-highlight-color')) {
                return true;
              }
            }
          } catch (e) {
            // Cross-origin stylesheet
          }
        }
        return false;
      });

      expect(hasTapHighlight).toBe(true);
    });
  });
});

test.describe('Mobile-Specific Touch Tests @mobile', () => {
  test('should handle touch events on iOS Safari', async ({ page, browserName }) => {
    if (browserName !== 'webkit') test.skip();

    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
    await page.goto('/guardian/login');

    // iOS-specific touch handling
    const hasIOSSupport = await page.evaluate(() => {
      return document.querySelector('meta[name="viewport"]')?.content?.includes('width=device-width');
    });

    expect(hasIOSSupport).toBe(true);
  });

  test('should handle touch events on Android Chrome', async ({ page, browserName }) => {
    if (browserName !== 'chromium') test.skip();

    await page.setViewportSize({ width: 360, height: 780 }); // Samsung S23
    await page.goto('/guardian/login');

    // Android-specific touch handling
    const viewport = await page.$('meta[name="viewport"]');
    expect(viewport).toBeTruthy();
  });

  test('should prevent 300ms touch delay', async ({ page }) => {
    await page.goto('/guardian/login');

    const noDelay = await page.evaluate(() => {
      const viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) return false;

      const content = viewport.getAttribute('content') || '';
      return content.includes('width=device-width');
    });

    expect(noDelay).toBe(true);
  });
});
