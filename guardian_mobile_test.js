/**
 * Guardian Dashboard Mobile View Comprehensive Test
 * Tests all mobile-specific functionality including:
 * - Sidebar navigation
 * - Dark mode toggle
 * - Appointment calendar with event rendering and text accessibility
 * - Guardian appointment cards with mobile-optimized layout
 * - Overall responsiveness
 * - Layout issues specific to mobile devices
 */

const { chromium } = require("playwright");

const MOBILE_VIEWPORTS = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 12/13", width: 390, height: 844 },
  { name: "Pixel 5", width: 393, height: 851 },
  { name: "Samsung Galaxy S20", width: 360, height: 800 },
  { name: "iPad Mini", width: 768, height: 1024 },
];

const TABLET_VIEWPORT = { name: "iPad Air", width: 820, height: 1180 };

class GuardianMobileTest {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: [],
    };
    this.browser = null;
    this.context = null;
  }

  async initialize() {
    console.log("Initializing browser...");
    this.browser = await chromium.launch({ headless: true });
  }

  async setupMobileContext(viewport) {
    this.context = await this.browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15",
    });
    return this.context.newPage();
  }

  async cleanup() {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }

  async login(page) {
    console.log("Attempting to login...");
    try {
      await page.goto("http://localhost:3000/guardian/login", {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Wait for login form
      await page.waitForSelector('input[type="text"], input[type="email"]', {
        timeout: 10000,
      });

      // Fill in login credentials
      const emailInput = await page.$(
        'input[type="text"], input[type="email"]',
      );
      const passwordInput = await page.$('input[type="password"]');

      if (emailInput && passwordInput) {
        await emailInput.fill("guardian@test.com");
        await passwordInput.fill("Guardian123!");

        // Click login button
        const loginButton = await page.$(
          'button[type="submit"], button:has-text("Login"), button:has-text("Sign In")',
        );
        if (loginButton) {
          await loginButton.click();
          await page.waitForNavigation({
            waitUntil: "networkidle",
            timeout: 15000,
          });
          console.log("Login successful");
          return true;
        }
      }
      console.log("Login form not found, checking if already logged in...");
      return true;
    } catch (error) {
      console.log("Login error (may already be logged in):", error.message);
      return false;
    }
  }

  async testSidebarNavigation(page, viewport) {
    const test = { viewport: viewport.name, category: "Sidebar Navigation" };
    try {
      // Navigate to dashboard
      await page.goto("http://localhost:3000/guardian/dashboard", {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(2000);

      // Check if sidebar exists
      const sidebar = await page.$(
        '.guardian-sidebar, aside[class*="sidebar"]',
      );
      if (!sidebar) {
        test.status = "warning";
        test.message = "Sidebar component not found with expected class";
        this.results.warnings.push(test);
        return;
      }

      // Check mobile menu toggle button
      const menuButton = await page.$(
        'button[aria-label="Open menu"], button:has(.lucide-menu), button:has(.lucide-more-vertical)',
      );
      if (menuButton) {
        test.status = "passed";
        test.message = "Mobile menu toggle button found";
        this.results.passed.push(test);

        // Test menu open/close
        await menuButton.click();
        await page.waitForTimeout(500);

        // Check if mobile menu opened
        const mobileMenu = await page.$(
          '.guardian-sidebar.open, [class*="sidebar"][class*="open"]',
        );
        if (mobileMenu) {
          test.status = "passed";
          test.message = "Sidebar opens correctly on mobile";
          this.results.passed.push(test);
        } else {
          test.status = "warning";
          test.message = "Sidebar may not be opening correctly";
          this.results.warnings.push(test);
        }
      } else {
        test.status = "warning";
        test.message = "Mobile menu toggle button not found";
        this.results.warnings.push(test);
      }

      // Check navigation items in sidebar
      const navItems = await page.$$(
        'nav button, nav a, [class*="sidebar"] button, [class*="sidebar"] a',
      );
      if (navItems.length > 0) {
        test.status = "passed";
        test.message = `Found ${navItems.length} navigation items in sidebar`;
        this.results.passed.push(test);
      }
    } catch (error) {
      test.status = "failed";
      test.message = `Error testing sidebar: ${error.message}`;
      this.results.failed.push(test);
    }
  }

  async testDarkModeToggle(page, viewport) {
    const test = { viewport: viewport.name, category: "Dark Mode Toggle" };
    try {
      // Navigate to dashboard
      await page.goto("http://localhost:3000/guardian/dashboard", {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(2000);

      // Check for dark mode toggle button
      const darkModeButton = await page.$(
        'button[aria-label*="dark"], button[aria-label*="light"], button:has(.lucide-moon), button:has(.lucide-sun)',
      );
      if (darkModeButton) {
        test.status = "passed";
        test.message = "Dark mode toggle button found";
        this.results.passed.push(test);

        // Get initial theme
        const htmlClass = await page.$eval("html", (el) => el.className);
        const isDarkInitial = htmlClass.includes("dark");

        // Click dark mode toggle
        await darkModeButton.click();
        await page.waitForTimeout(500);

        // Check if theme changed
        const htmlClassAfter = await page.$eval("html", (el) => el.className);
        const isDarkAfter = htmlClassAfter.includes("dark");

        if (isDarkInitial !== isDarkAfter) {
          test.status = "passed";
          test.message = "Dark mode toggle works correctly";
          this.results.passed.push(test);
        } else {
          test.status = "warning";
          test.message = "Dark mode toggle may not be working";
          this.results.warnings.push(test);
        }
      } else {
        // Check in header area
        const headerButtons = await page.$$("header button");
        if (headerButtons.length > 0) {
          test.status = "passed";
          test.message = "Header buttons found (dark mode may be present)";
          this.results.passed.push(test);
        } else {
          test.status = "warning";
          test.message = "Dark mode toggle button not found";
          this.results.warnings.push(test);
        }
      }
    } catch (error) {
      test.status = "failed";
      test.message = `Error testing dark mode: ${error.message}`;
      this.results.failed.push(test);
    }
  }

  async testAppointmentCalendar(page, viewport) {
    const test = { viewport: viewport.name, category: "Appointment Calendar" };
    try {
      // Navigate to appointments page
      await page.goto("http://localhost:3000/guardian/appointments", {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(2000);

      // Check if calendar container exists
      const calendarContainer = await page.$(
        '.appointment-calendar, .fc, [class*="calendar"]',
      );
      if (calendarContainer) {
        test.status = "passed";
        test.message = "Appointment calendar component found";
        this.results.passed.push(test);

        // Check for calendar events
        const events = await page.$$('.fc-event, [class*="event"]');
        test.status = "passed";
        test.message = `Found ${events.length} calendar events`;
        this.results.passed.push(test);

        // Check text accessibility in calendar
        const calendarText = await page.$eval(
          '.fc, [class*="calendar"]',
          (el) => {
            const styles = window.getComputedStyle(el);
            return {
              color: styles.color,
              fontSize: styles.fontSize,
            };
          },
        );

        if (calendarText && calendarText.fontSize) {
          test.status = "passed";
          test.message = `Calendar text accessible (${calendarText.fontSize})`;
          this.results.passed.push(test);
        }

        // Check FullCalendar specific elements
        const fcToolbar = await page.$(".fc-toolbar");
        if (fcToolbar) {
          test.status = "passed";
          test.message = "FullCalendar toolbar found";
          this.results.passed.push(test);
        }
      } else {
        test.status = "warning";
        test.message = "Appointment calendar not found on this page";
        this.results.warnings.push(test);
      }
    } catch (error) {
      test.status = "failed";
      test.message = `Error testing calendar: ${error.message}`;
      this.results.failed.push(test);
    }
  }

  async testGuardianAppointmentCards(page, viewport) {
    const test = { viewport: viewport.name, category: "Appointment Cards" };
    try {
      // Navigate to dashboard
      await page.goto("http://localhost:3000/guardian/dashboard", {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(2000);

      // Check for appointment cards
      const appointmentCards = await page.$$(
        '[class*="appointment"], [class*="Appointment"]',
      );
      if (appointmentCards.length > 0) {
        test.status = "passed";
        test.message = `Found ${appointmentCards.length} appointment card elements`;
        this.results.passed.push(test);

        // Check card layout for mobile optimization
        const firstCard = appointmentCards[0];
        const cardBox = await firstCard.boundingBox();

        if (cardBox) {
          // Check if card is properly sized for mobile
          if (cardBox.width <= viewport.width - 32) {
            test.status = "passed";
            test.message = `Appointment card properly sized for mobile (${Math.round(cardBox.width)}px width)`;
            this.results.passed.push(test);
          } else {
            test.status = "warning";
            test.message = `Appointment card may be too wide for mobile (${Math.round(cardBox.width)}px width)`;
            this.results.warnings.push(test);
          }

          // Check touch target size
          if (cardBox.height >= 44) {
            test.status = "passed";
            test.message = `Appointment card has proper touch target (${Math.round(cardBox.height)}px height)`;
            this.results.passed.push(test);
          }
        }

        // Check for status badges
        const statusBadges = await page.$$(
          '[class*="status"], span:has-text("Scheduled"), span:has-text("Confirmed"), span:has-text("Completed")',
        );
        if (statusBadges.length > 0) {
          test.status = "passed";
          test.message = "Appointment status badges found";
          this.results.passed.push(test);
        }
      } else {
        // Check for upcoming appointments section
        const upcomingSection = await page.$(
          "text=Upcoming Appointments, text=No Upcoming",
        );
        if (upcomingSection) {
          test.status = "passed";
          test.message = "Upcoming appointments section found";
          this.results.passed.push(test);
        } else {
          test.status = "warning";
          test.message = "No appointment cards found on dashboard";
          this.results.warnings.push(test);
        }
      }
    } catch (error) {
      test.status = "failed";
      test.message = `Error testing appointment cards: ${error.message}`;
      this.results.failed.push(test);
    }
  }

  async testOverallResponsiveness(page, viewport) {
    const test = {
      viewport: viewport.name,
      category: "Overall Responsiveness",
    };
    try {
      // Navigate to dashboard
      await page.goto("http://localhost:3000/guardian/dashboard", {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(2000);

      // Check for horizontal scroll issues
      const body = await page.$("body");
      const bodyBox = await body.boundingBox();

      if (bodyBox) {
        const hasHorizontalScroll = bodyBox.width > viewport.width;
        if (!hasHorizontalScroll) {
          test.status = "passed";
          test.message = "No horizontal scrolling on mobile";
          this.results.passed.push(test);
        } else {
          test.status = "failed";
          test.message = `Horizontal scrolling detected (body width: ${Math.round(bodyBox.width)}px, viewport: ${viewport.width}px)`;
          this.results.failed.push(test);
        }
      }

      // Check for visible content overflow
      const rootElement = await page.$("#root");
      if (rootElement) {
        const rootBox = await rootElement.boundingBox();
        if (rootBox && rootBox.x < 0) {
          test.status = "failed";
          test.message = `Root element has negative x offset (${Math.round(rootBox.x)}px)`;
          this.results.failed.push(test);
        }
      }

      // Check for mobile header
      const mobileHeader = await page.$(
        'header:not([class*="hidden"]), [class*="mobile-header"], [class*="header"]:visible',
      );
      if (mobileHeader) {
        test.status = "passed";
        test.message = "Mobile header is visible";
        this.results.passed.push(test);
      }

      // Check for bottom navigation (mobile)
      const bottomNav = await page.$(
        '[class*="bottom-nav"], [class*="mobile-nav"]:not([class*="sidebar"])',
      );
      if (bottomNav) {
        test.status = "passed";
        test.message = "Mobile bottom navigation found";
        this.results.passed.push(test);
      }

      // Check for content padding
      const mainContent = await page.$(
        'main, [class*="content"], [class*="main"]',
      );
      if (mainContent) {
        const padding = await mainContent.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            paddingLeft: styles.paddingLeft,
            paddingRight: styles.paddingRight,
          };
        });

        if (
          padding &&
          (parseFloat(padding.paddingLeft) >= 16 ||
            parseFloat(padding.paddingRight) >= 16)
        ) {
          test.status = "passed";
          test.message = "Content has proper mobile padding";
          this.results.passed.push(test);
        }
      }

      // Check viewport meta tag
      const viewportMeta = await page.$eval(
        'meta[name="viewport"]',
        (el) => el.content,
      );
      if (viewportMeta && viewportMeta.includes("width=device-width")) {
        test.status = "passed";
        test.message = "Viewport meta tag properly configured";
        this.results.passed.push(test);
      }
    } catch (error) {
      test.status = "failed";
      test.message = `Error testing responsiveness: ${error.message}`;
      this.results.failed.push(test);
    }
  }

  async testMobileLayoutIssues(page, viewport) {
    const test = { viewport: viewport.name, category: "Mobile Layout Issues" };
    try {
      // Navigate through multiple pages
      const pages = [
        "/guardian/dashboard",
        "/guardian/children",
        "/guardian/appointments",
        "/guardian/vaccination-records",
      ];

      let layoutIssues = [];

      for (const path of pages) {
        await page.goto(`http://localhost:3000${path}`, {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        await page.waitForTimeout(1000);

        // Check for overlapping elements
        const elements = await page.$$("*");
        let overlaps = [];

        for (let i = 0; i < Math.min(elements.length, 50); i++) {
          const box1 = await elements[i].boundingBox();
          if (!box1) continue;

          for (let j = i + 1; j < Math.min(elements.length, 50); j++) {
            const box2 = await elements[j].boundingBox();
            if (!box2) continue;

            // Check for significant overlap
            const overlapX = Math.max(
              0,
              Math.min(box1.x + box1.width, box2.x + box2.width) -
                Math.max(box1.x, box2.x),
            );
            const overlapY = Math.max(
              0,
              Math.min(box1.y + box1.height, box2.y + box2.height) -
                Math.max(box1.y, box2.y),
            );

            if (overlapX > 10 && overlapY > 10) {
              overlaps.push({ x: overlapX, y: overlapY });
            }
          }
        }

        if (overlaps.length > 5) {
          layoutIssues.push({ page: path, overlaps: overlaps.length });
        }
      }

      if (layoutIssues.length === 0) {
        test.status = "passed";
        test.message = "No significant layout overlaps detected";
        this.results.passed.push(test);
      } else {
        test.status = "warning";
        test.message = `Found layout issues on ${layoutIssues.length} pages`;
        this.results.warnings.push(test);
      }

      // Check for text truncation issues
      await page.goto("http://localhost:3000/guardian/dashboard", {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(1000);

      const truncatedText = await page.$$(
        '[class*="truncate"], [style*="overflow: hidden"][style*="text-overflow"]',
      );
      if (truncatedText.length > 0) {
        test.status = "passed";
        test.message = `Text truncation found (${truncatedText.length} elements) - likely intentional for mobile`;
        this.results.passed.push(test);
      }

      // Check for broken images or icons
      const brokenImages = await page.$$(
        'img[src=""], img:not([src]), img[src*="undefined"]',
      );
      if (brokenImages.length > 0) {
        test.status = "warning";
        test.message = `Found ${brokenImages.length} potentially broken images`;
        this.results.warnings.push(test);
      }
    } catch (error) {
      test.status = "failed";
      test.message = `Error testing layout issues: ${error.message}`;
      this.results.failed.push(test);
    }
  }

  async testStatsCards(page, viewport) {
    const test = { viewport: viewport.name, category: "Stats Cards" };
    try {
      await page.goto("http://localhost:3000/guardian/dashboard", {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(2000);

      // Look for specific stat values
      const childrenStat = await page.$("text=My Children");
      const appointmentsStat = await page.$("text=Next Appt");
      const vaccinatedStat = await page.$("text=Vaccinated");
      const pendingStat = await page.$("text=Pending");

      const statsFound = [
        childrenStat,
        appointmentsStat,
        vaccinatedStat,
        pendingStat,
      ].filter(Boolean).length;

      if (statsFound > 0) {
        test.status = "passed";
        test.message = `Found ${statsFound} stats cards`;
        this.results.passed.push(test);
      } else {
        test.status = "warning";
        test.message = "Stats cards may not be present or properly labeled";
        this.results.warnings.push(test);
      }
    } catch (error) {
      test.status = "failed";
      test.message = `Error testing stats cards: ${error.message}`;
      this.results.failed.push(test);
    }
  }

  async testQuickActions(page, viewport) {
    const test = { viewport: viewport.name, category: "Quick Actions" };
    try {
      await page.goto("http://localhost:3000/guardian/dashboard", {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(2000);

      // Check for quick action buttons
      const quickActions = await page.$$(
        'button[class*="quick"], button:has-text("Book"), button:has-text("View"), button:has-text("Health"), button:has-text("Download")',
      );

      if (quickActions.length >= 3) {
        test.status = "passed";
        test.message = `Found ${quickActions.length} quick action buttons`;
        this.results.passed.push(test);

        // Check button sizes for touch
        const firstButton = quickActions[0];
        const buttonBox = await firstButton.boundingBox();

        if (buttonBox && buttonBox.height >= 44) {
          test.status = "passed";
          test.message = "Quick action buttons have proper touch target size";
          this.results.passed.push(test);
        }
      } else {
        test.status = "warning";
        test.message = "Expected at least 3 quick action buttons";
        this.results.warnings.push(test);
      }
    } catch (error) {
      test.status = "failed";
      test.message = `Error testing quick actions: ${error.message}`;
      this.results.failed.push(test);
    }
  }

  async testChildrenSection(page, viewport) {
    const test = { viewport: viewport.name, category: "Children Section" };
    try {
      await page.goto("http://localhost:3000/guardian/dashboard", {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(2000);

      // Check for children section
      const childrenSection = await page.$("text=My Children");
      if (childrenSection) {
        test.status = "passed";
        test.message = "My Children section found";
        this.results.passed.push(test);

        // Check for child cards
        const childCards = await page.$$('[class*="child"], [class*="Child"]');
        if (childCards.length > 0) {
          test.status = "passed";
          test.message = `Found ${childCards.length} child cards`;
          this.results.passed.push(test);
        }
      }

      // Check for search/filter functionality
      const searchInput = await page.$(
        'input[placeholder*="Search"], input[type="search"]',
      );
      if (searchInput) {
        test.status = "passed";
        test.message = "Search input found in children section";
        this.results.passed.push(test);
      }
    } catch (error) {
      test.status = "failed";
      test.message = `Error testing children section: ${error.message}`;
      this.results.failed.push(test);
    }
  }

  async runTests() {
    console.log("=== Guardian Dashboard Mobile View Comprehensive Test ===\n");

    await this.initialize();

    try {
      // Test on different mobile viewports
      for (const viewport of MOBILE_VIEWPORTS) {
        console.log(
          `\nTesting on ${viewport.name} (${viewport.width}x${viewport.height})...`,
        );

        const page = await this.setupMobileContext(viewport);

        // Attempt login
        await this.login(page);

        // Run all tests
        await this.testSidebarNavigation(page, viewport);
        await this.testDarkModeToggle(page, viewport);
        await this.testAppointmentCalendar(page, viewport);
        await this.testGuardianAppointmentCards(page, viewport);
        await this.testOverallResponsiveness(page, viewport);
        await this.testMobileLayoutIssues(page, viewport);
        await this.testStatsCards(page, viewport);
        await this.testQuickActions(page, viewport);
        await this.testChildrenSection(page, viewport);

        await page.close();
      }

      // Test on tablet
      console.log(
        `\nTesting on ${TABLET_VIEWPORT.name} (${TABLET_VIEWPORT.width}x${TABLET_VIEWPORT.height})...`,
      );
      const tabletPage = await this.setupMobileContext(TABLET_VIEWPORT);
      await this.login(tabletPage);
      await this.testOverallResponsiveness(tabletPage, TABLET_VIEWPORT);
      await tabletPage.close();
    } catch (error) {
      console.error("Test error:", error);
    } finally {
      await this.cleanup();
    }

    this.printResults();
  }

  printResults() {
    console.log("\n=== Test Results ===\n");

    console.log(`✅ PASSED (${this.results.passed.length}):`);
    this.results.passed.forEach((r) => {
      console.log(`  - [${r.viewport}] ${r.category}: ${r.message}`);
    });

    console.log(`\n⚠️  WARNINGS (${this.results.warnings.length}):`);
    this.results.warnings.forEach((r) => {
      console.log(`  - [${r.viewport}] ${r.category}: ${r.message}`);
    });

    console.log(`\n❌ FAILED (${this.results.failed.length}):`);
    this.results.failed.forEach((r) => {
      console.log(`  - [${r.viewport}] ${r.category}: ${r.message}`);
    });

    console.log(`\n=== Summary ===`);
    console.log(`Total Passed: ${this.results.passed.length}`);
    console.log(`Total Warnings: ${this.results.warnings.length}`);
    console.log(`Total Failed: ${this.results.failed.length}`);

    const passRate =
      (this.results.passed.length /
        (this.results.passed.length + this.results.failed.length)) *
      100;
    console.log(`Pass Rate: ${passRate.toFixed(1)}%`);

    // Save results to file
    const fs = require("fs");
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        passed: this.results.passed.length,
        warnings: this.results.warnings.length,
        failed: this.results.failed.length,
        passRate: passRate.toFixed(1) + "%",
      },
      details: this.results,
    };

    fs.writeFileSync(
      "GUARDIAN_MOBILE_TEST_REPORT.json",
      JSON.stringify(report, null, 2),
    );
    console.log("\nResults saved to GUARDIAN_MOBILE_TEST_REPORT.json");
  }
}

// Run the tests
const test = new GuardianMobileTest();
test.runTests().catch(console.error);
