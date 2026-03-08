/**
 * Guardian Dashboard Mobile View - Static Code Analysis
 * Comprehensive analysis of mobile-specific code implementation
 */

const fs = require("fs");
const path = require("path");

class MobileCodeAnalyzer {
  constructor() {
    this.findings = {
      passed: [],
      failed: [],
      warnings: [],
      info: [],
    };
  }

  analyzeFile(filePath, fileName) {
    const content = fs.readFileSync(filePath, "utf8");
    console.log(`\nAnalyzing: ${fileName}`);

    // Check for mobile-specific classes and patterns
    this.checkMobileClasses(content, fileName);
    this.checkResponsivePatterns(content, fileName);
    this.checkTouchTargets(content, fileName);
    this.checkDarkModeImplementation(content, fileName);
    this.checkSidebarMobile(content, fileName);
    this.checkCalendarMobile(content, fileName);
    this.checkAccessibility(content, fileName);
  }

  checkMobileClasses(content, fileName) {
    // Check for mobile-specific CSS classes
    const mobilePatterns = [
      {
        pattern: /mobile-scrollbar|guardian-scrollbar/gi,
        name: "Mobile scrollbar class",
      },
      {
        pattern: /md:hidden|lg:hidden|sm:hidden/gi,
        name: "Responsive hide classes",
      },
      {
        pattern: /min-h-\[44px\]|min-h-\[48px\]/gi,
        name: "Touch target minimum (44-48px)",
      },
      { pattern: /touch-manipulation/gi, name: "Touch manipulation CSS" },
      {
        pattern: /mobile-nav|guardian-bottom-nav/gi,
        name: "Mobile navigation",
      },
    ];

    mobilePatterns.forEach(({ pattern, name }) => {
      const matches = content.match(pattern);
      if (matches) {
        this.findings.passed.push({
          file: fileName,
          category: "Mobile Classes",
          message: `${name}: Found ${matches.length} occurrences`,
        });
      } else {
        this.findings.warnings.push({
          file: fileName,
          category: "Mobile Classes",
          message: `${name}: Not found`,
        });
      }
    });
  }

  checkResponsivePatterns(content, fileName) {
    // Check for responsive design patterns
    const responsivePatterns = [
      {
        pattern: /@media.*max-width|@media.*min-width/gi,
        name: "Media queries",
      },
      { pattern: /grid-cols-1|grid-cols-2/gi, name: "Responsive grid classes" },
      { pattern: /sm:|md:|lg:|xl:/gi, name: "Tailwind responsive prefixes" },
      { pattern: /w-full.*md:w|md:w-full/gi, name: "Responsive width" },
    ];

    responsivePatterns.forEach(({ pattern, name }) => {
      const matches = content.match(pattern);
      if (matches && matches.length > 2) {
        this.findings.passed.push({
          file: fileName,
          category: "Responsive Patterns",
          message: `${name}: Found ${matches.length} occurrences`,
        });
      }
    });
  }

  checkTouchTargets(content, fileName) {
    // Check for touch-friendly button sizes
    const touchPatterns = [
      {
        pattern: /min-w-\[44px\]|min-w-\[48px\]/gi,
        name: "Minimum touch width",
      },
      {
        pattern: /min-h-\[44px\]|min-h-\[48px\]|min-h-\[52px\]/gi,
        name: "Minimum touch height",
      },
      { pattern: /p-2.*p-3|p-3.*p-4/gi, name: "Touch-friendly padding" },
      { pattern: /text-sm|text-xs/gi, name: "Readable text size" },
    ];

    touchPatterns.forEach(({ pattern, name }) => {
      const matches = content.match(pattern);
      if (matches) {
        this.findings.passed.push({
          file: fileName,
          category: "Touch Targets",
          message: `${name}: Found`,
        });
      }
    });
  }

  checkDarkModeImplementation(content, fileName) {
    // Check for dark mode implementation
    const darkPatterns = [
      { pattern: /dark:/gi, name: "Dark mode Tailwind classes" },
      {
        pattern: /dark:bg|dark:text|dark:border/gi,
        name: "Dark mode color classes",
      },
      { pattern: /darkMode|isDark/gi, name: "Dark mode state variable" },
      { pattern: /toggleDarkMode/gi, name: "Dark mode toggle function" },
    ];

    darkPatterns.forEach(({ pattern, name }) => {
      const matches = content.match(pattern);
      if (matches) {
        this.findings.passed.push({
          file: fileName,
          category: "Dark Mode",
          message: `${name}: Found (${matches.length} occurrences)`,
        });
      }
    });
  }

  checkSidebarMobile(content, fileName) {
    // Check for sidebar mobile implementation
    if (fileName.includes("Sidebar") || fileName.includes("Layout")) {
      const sidebarPatterns = [
        { pattern: /fixed.*z-50|fixed.*z-40/gi, name: "Fixed positioning" },
        { pattern: /translate-x|transform/gi, name: "Slide animation" },
        { pattern: /isOpen|sidebarOpen/gi, name: "Open/close state" },
        { pattern: /onClose|handleClose/gi, name: "Close handler" },
        { pattern: /md:hidden|lg:hidden/gi, name: "Mobile-only visibility" },
        { pattern: /min-w-\[44px\]/gi, name: "Touch-friendly menu button" },
      ];

      sidebarPatterns.forEach(({ pattern, name }) => {
        const matches = content.match(pattern);
        if (matches) {
          this.findings.passed.push({
            file: fileName,
            category: "Sidebar Mobile",
            message: `${name}: Found`,
          });
        }
      });
    }
  }

  checkCalendarMobile(content, fileName) {
    // Check for calendar mobile implementation
    if (fileName.includes("Calendar") || fileName.includes("Appointment")) {
      const calendarPatterns = [
        {
          pattern: /fc-event|calendar-event/gi,
          name: "Calendar event styling",
        },
        {
          pattern: /color.*white|color.*#ffffff/gi,
          name: "High contrast text",
        },
        {
          pattern: /font-size.*0\.\d+rem|font-size.*\d+px/gi,
          name: "Event text sizing",
        },
        { pattern: /aria-label|role=/gi, name: "Accessibility attributes" },
        { pattern: /dark .fc|\.dark.*calendar/gi, name: "Dark mode calendar" },
      ];

      calendarPatterns.forEach(({ pattern, name }) => {
        const matches = content.match(pattern);
        if (matches) {
          this.findings.passed.push({
            file: fileName,
            category: "Calendar Mobile",
            message: `${name}: Found`,
          });
        }
      });
    }
  }

  checkAccessibility(content, fileName) {
    // Check for accessibility features
    const a11yPatterns = [
      { pattern: /aria-label/gi, name: "ARIA labels" },
      { pattern: /role=/gi, name: "ARIA roles" },
      { pattern: /aria-expanded/gi, name: "Expanded state" },
      { pattern: /focus:|focus-visible/gi, name: "Focus styles" },
      { pattern: /sr-only|screen-reader/gi, name: "Screen reader text" },
    ];

    a11yPatterns.forEach(({ pattern, name }) => {
      const matches = content.match(pattern);
      if (matches) {
        this.findings.passed.push({
          file: fileName,
          category: "Accessibility",
          message: `${name}: Found (${matches.length} occurrences)`,
        });
      }
    });
  }

  analyzeCSSFiles() {
    console.log("\n=== Analyzing CSS Files ===");

    const cssDir = path.join(__dirname, "src", "css");
    const files = fs.readdirSync(cssDir);

    const mobileCSSFiles = files.filter(
      (f) =>
        f.includes("mobile") ||
        f.includes("responsive") ||
        f.includes("guardian"),
    );

    console.log(`Found ${mobileCSSFiles.length} mobile-related CSS files:`);
    mobileCSSFiles.forEach((f) => {
      console.log(`  - ${f}`);
      const content = fs.readFileSync(path.join(cssDir, f), "utf8");

      // Check key mobile features
      if (f.includes("guardian")) {
        if (
          content.includes("position: fixed") &&
          content.includes("bottom: 0")
        ) {
          this.findings.passed.push({
            file: f,
            category: "CSS Features",
            message: "Fixed bottom navigation CSS found",
          });
        }
        if (
          content.includes("min-height: 44px") ||
          content.includes("min-height: 48px")
        ) {
          this.findings.passed.push({
            file: f,
            category: "CSS Features",
            message: "Touch target minimum CSS found",
          });
        }
        if (content.includes("@media")) {
          const mediaQueries = content.match(/@media.*max-width/g);
          if (mediaQueries) {
            this.findings.passed.push({
              file: f,
              category: "CSS Features",
              message: `Media queries for mobile: ${mediaQueries.length} found`,
            });
          }
        }
      }
    });
  }

  runAnalysis() {
    console.log("=== Guardian Dashboard Mobile Code Analysis ===\n");

    const componentsDir = path.join(__dirname, "src", "components");
    const pagesDir = path.join(__dirname, "src", "pages");

    // Analyze key component files
    const filesToAnalyze = [
      "GuardianDashboard.jsx",
      "GuardianLayout.jsx",
      "GuardianSidebar.jsx",
      "GuardianHeader.jsx",
      "MobileBottomNav.jsx",
    ];

    filesToAnalyze.forEach((fileName) => {
      const filePath = path.join(componentsDir, fileName);
      if (fs.existsSync(filePath)) {
        this.analyzeFile(filePath, fileName);
      } else {
        // Try pages directory
        const pagePath = path.join(pagesDir, fileName);
        if (fs.existsSync(pagePath)) {
          this.analyzeFile(pagePath, fileName);
        }
      }
    });

    // Also check pages
    const dashboardPath = path.join(pagesDir, "GuardianDashboard.jsx");
    if (fs.existsSync(dashboardPath)) {
      this.analyzeFile(dashboardPath, "GuardianDashboard.jsx");
    }

    // Analyze CSS files
    this.analyzeCSSFiles();

    this.printResults();
  }

  printResults() {
    console.log("\n=== Analysis Results ===\n");

    console.log(`✅ PASSED (${this.findings.passed.length}):`);
    this.findings.passed.forEach((f) => {
      console.log(`  [${f.category}] ${f.file}: ${f.message}`);
    });

    console.log(`\n⚠️  WARNINGS (${this.findings.warnings.length}):`);
    this.findings.warnings.forEach((f) => {
      console.log(`  [${f.category}] ${f.file}: ${f.message}`);
    });

    console.log(`\n=== Summary ===`);
    console.log(`Total Passed: ${this.findings.passed.length}`);
    console.log(`Total Warnings: ${this.findings.warnings.length}`);

    // Group by category
    const categories = {};
    this.findings.passed.forEach((f) => {
      if (!categories[f.category]) categories[f.category] = 0;
      categories[f.category]++;
    });

    console.log("\n=== Mobile Features by Category ===");
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count} features`);
    });

    // Save results
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        passed: this.findings.passed.length,
        warnings: this.findings.warnings.length,
        categories: categories,
      },
      findings: this.findings,
    };

    fs.writeFileSync(
      "GUARDIAN_MOBILE_ANALYSIS_REPORT.json",
      JSON.stringify(report, null, 2),
    );
    console.log("\nAnalysis saved to GUARDIAN_MOBILE_ANALYSIS_REPORT.json");
  }
}

const analyzer = new MobileCodeAnalyzer();
analyzer.runAnalysis();
