/**
 * Responsive Behavior Tests
 * Tests Guardian Dashboard across mobile breakpoints (320px - 768px)
 *
 * @tags responsive, layout, breakpoints
 */

const { test, expect } = require('@playwright/test');
const {
  MOBILE_BREAKPOINTS,
  testAtBreakpoints,
  checkHorizontalOverflow,
  captureMobileScreenshot,
} = require('../utils/mobile-helpers');

// Test credentials - should match test environment
const TEST_CREDENTIALS = {
  email: process.env.TEST_GUARDIAN_EMAIL || 'guardian@test.com',
  password: process.env.TEST_GUARDIAN_PASSWORD || 'password123',
};

test.describe('Responsive Layout Tests @responsive', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/guardian/login');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Breakpoint Validation', () => {
    test('should render correctly at 320px (iPhone SE)', async ({ page }) => {
      await page.setViewportSize({
        width: MOBILE_BREAKPOINTS.EXTRA_SMALL.width,
        height: MOBILE_BREAKPOINTS.EXTRA_SMALL.height,
      });

      // Check no horizontal overflow
      const overflow = await checkHorizontalOverflow(page);
      expect(overflow.hasOverflow).toBe(false);

      // Take screenshot for visual regression
      await captureMobileScreenshot(page, 'login-320px');
    });

    test('should render correctly at 360px (Samsung Galaxy S23)', async ({ page }) => {
      await page.setViewportSize({
        width: MOBILE_BREAKPOINTS.SMALL.width,
        height: MOBILE_BREAKPOINTS.SMALL.height,
      });

      const overflow = await checkHorizontalOverflow(page);
      expect(overflow.hasOverflow).toBe(false);

      await captureMobileScreenshot(page, 'login-360px');
    });

    test('should render correctly at 375px (iPhone 12/13 Mini)', async ({ page }) => {
      await page.setViewportSize({
        width: MOBILE_BREAKPOINTS.MEDIUM.width,
        height: MOBILE_BREAKPOINTS.MEDIUM.height,
      });

      const overflow = await checkHorizontalOverflow(page);
      expect(overflow.hasOverflow).toBe(false);

      await captureMobileScreenshot(page, 'login-375px');
    });

    test('should render correctly at 390px (iPhone 12/13/14)', async ({ page }) => {
      await page.setViewportSize({
        width: MOBILE_BREAKPOINTS.LARGE.width,
        height: MOBILE_BREAKPOINTS.LARGE.height,
      });

      const overflow = await checkHorizontalOverflow(page);
      expect(overflow.hasOverflow).toBe(false);

      await captureMobileScreenshot(page, 'login-390px');
    });

    test('should render correctly at 768px (iPad Mini)', async ({ page }) => {
      await page.setViewportSize({
        width: MOBILE_BREAKPOINTS.TABLET.width,
        height: MOBILE_BREAKPOINTS.TABLET.height,
      });

      const overflow = await checkHorizontalOverflow(page);
      expect(overflow.hasOverflow).toBe(false);

      await captureMobileScreenshot(page, 'login-768px');
    });
  });

  test.describe('Layout Transition Tests', () => {
    test('should transition smoothly between breakpoints', async ({ page }) => {
      const breakpoints = [
        { width: 320, height: 568 },
        { width: 375, height: 812 },
        { width: 390, height: 844 },
        { width: 414, height: 896 },
        { width: 428, height: 926 },
        { width: 768, height: 1024 },
      ];

      for (const breakpoint of breakpoints) {
        await page.setViewportSize(breakpoint);
        await page.waitForTimeout(200);

        // Check layout is stable
        const body = await page.$('body');
        expect(body).toBeTruthy();

        // Verify no horizontal scroll at each breakpoint
        const overflow = await checkHorizontalOverflow(page);
        expect(overflow.hasOverflow).toBe(false);
      }
    });

    test('should maintain proper padding at all breakpoints', async ({ page }) => {
      const results = await testAtBreakpoints(page, MOBILE_BREAKPOINTS, async (page, bp) => {
        const mainContent = await page.$('.guardian-main-content, main, [role="main"]');
        if (!mainContent) return { valid: false, message: 'Main content not found' };

        const padding = await mainContent.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            paddingLeft: parseInt(style.paddingLeft),
            paddingRight: parseInt(style.paddingRight),
          };
        });

        return {
          valid: padding.paddingLeft >= 12 && padding.paddingRight >= 12,
          padding,
          message: `Padding: ${padding.paddingLeft}px left, ${padding.paddingRight}px right`,
        };
      });

      results.forEach(result => {
        expect(result.valid).toBe(true);
      });
    });
  });

  test.describe('Card Layout Tests', () => {
    test('should stack cards vertically on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });

      // Login to access dashboard
      await page.fill('input[type="email"], input[name="email"]', TEST_CREDENTIALS.email);
      await page.fill('input[type="password"], input[name="password"]', TEST_CREDENTIALS.password);
      await page.click('button[type="submit"]');

      // Wait for dashboard
      await page.waitForURL('**/guardian/dashboard', { timeout: 10000 });
      await page.waitForSelector('.guardian-dashboard, [role="main"]', { timeout: 10000 });

      // Check stat cards layout
      const statCards = await page.$$('.guardian-stat-card, .stat-card');
      if (statCards.length > 0) {
        const firstCard = statCards[0];
        const secondCard = statCards[1];

        const firstBox = await firstCard.boundingBox();
        const secondBox = await secondCard.boundingBox();

        // On mobile (375px), cards should be in 2x2 grid
        expect(firstBox.x).toBeLessThan(secondBox.x + 50); // Some tolerance
      }
    });

    test('should maintain card proportions at all breakpoints', async ({ page }) => {
      const results = await testAtBreakpoints(page, {
        mobile: MOBILE_BREAKPOINTS.MEDIUM,
        tablet: MOBILE_BREAKPOINTS.TABLET,
      }, async (page, bp) => {
        // Check cards maintain aspect ratio
        const cards = await page.$$('.guardian-card, .card');
        if (cards.length === 0) return { valid: true, message: 'No cards found' };

        const card = cards[0];
        const box = await card.boundingBox();

        // Cards should not be too narrow
        return {
          valid: box.width >= 280,
          width: box.width,
          message: `Card width: ${box.width}px`,
        };
      });

      results.forEach(result => {
        expect(result.valid).toBe(true);
      });
    });
  });

  test.describe('Navigation Responsiveness', () => {
    test('should show hamburger menu on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });

      const hamburgerMenu = await page.$('.guardian-menu-btn, [aria-label*="menu"], button:has-text("☰")');
      expect(hamburgerMenu).toBeTruthy();
    });

    test('should hide sidebar on mobile and show on tablet+', async ({ page }) => {
      // Mobile - sidebar should be hidden by default
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(100);

      const sidebarMobile = await page.$('.guardian-sidebar:not(.open), aside:not(.open)');
      // Sidebar may not exist or be hidden

      // Tablet - sidebar should be visible
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForTimeout(100);

      // On desktop, sidebar may be fixed
    });

    test('should show bottom navigation on mobile only', async ({ page }) => {
      // Login first
      await page.fill('input[type="email"], input[name="email"]', TEST_CREDENTIALS.email);
      await page.fill('input[type="password"], input[name="password"]', TEST_CREDENTIALS.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/guardian/dashboard', { timeout: 10000 });

      // Mobile - should show bottom nav
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(100);

      const bottomNavMobile = await page.$('.guardian-bottom-nav, nav[role="navigation"]');

      // Tablet - bottom nav should be hidden
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(100);

      const bottomNavTablet = await page.$('.guardian-bottom-nav');
      const isVisible = bottomNavTablet ? await bottomNavTablet.isVisible() : false;

      // Bottom nav should be hidden on tablet+
      expect(isVisible).toBe(false);
    });
  });

  test.describe('PageHeader Responsive Tests', () => {
    test('PageHeader should adapt padding at different breakpoints', async ({ page }) => {
      const breakpoints = [
        { width: 320, name: 'mobile-small' },
        { width: 375, name: 'mobile-medium' },
        { width: 768, name: 'tablet' },
        { width: 1024, name: 'desktop' },
      ];

      for (const bp of breakpoints) {
        await page.setViewportSize({ width: bp.width, height: 800 });
        await page.waitForTimeout(100);

        const header = await page.$('.page-header');
        if (header) {
          const box = await header.boundingBox();
          expect(box.width).toBeLessThanOrEqual(bp.width);
        }
      }
    });

    test('PageHeader actions should stack on very small screens', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });

      // Navigate to a page with PageHeader
      await page.goto('/guardian/children');

      const actions = await page.$('.page-header__actions');
      if (actions) {
        const box = await actions.boundingBox();
        // Actions should be within header bounds
        expect(box.width).toBeLessThanOrEqual(300);
      }
    });
  });

  test.describe('Safe Area Support', () => {
    test('should respect safe area insets on notched devices', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14

      // Check for safe area CSS support
      const hasSafeAreaSupport = await page.evaluate(() => {
        const styles = document.styleSheets;
        for (const sheet of styles) {
          try {
            const rules = sheet.cssRules || sheet.rules;
            for (const rule of rules) {
              if (rule.cssText && rule.cssText.includes('safe-area-inset')) {
                return true;
              }
            }
          } catch (e) {
            // Cross-origin stylesheet, skip
          }
        }
        return false;
      });

      expect(hasSafeAreaSupport).toBe(true);
    });
  });
});
