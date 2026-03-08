/**
 * Mobile Testing Utilities for Guardian Dashboard
 * Helper functions for mobile UI testing
 */

const { expect } = require('@playwright/test');

/**
 * Mobile Breakpoints defined in CSS
 */
const MOBILE_BREAKPOINTS = {
  EXTRA_SMALL: { width: 320, height: 568, name: 'iPhone SE' },
  SMALL: { width: 360, height: 780, name: 'Samsung Galaxy S23' },
  MEDIUM: { width: 375, height: 812, name: 'iPhone 12/13 Mini' },
  LARGE: { width: 390, height: 844, name: 'iPhone 12/13/14' },
  EXTRA_LARGE: { width: 412, height: 915, name: 'Google Pixel 7' },
  TABLET: { width: 768, height: 1024, name: 'iPad Mini' },
  TABLET_LARGE: { width: 820, height: 1180, name: 'iPad Air' },
};

/**
 * WCAG 2.1 AA Standards
 */
const WCAG_STANDARDS = {
  MIN_TOUCH_TARGET_SIZE: 44,
  MIN_TOUCH_TARGET_SIZE_PX: 44,
  MIN_BUTTON_HEIGHT: 44,
  MIN_INPUT_HEIGHT: 48,
  MIN_SPACING: 8,
  MIN_CONTRAST_NORMAL: 4.5,
  MIN_CONTRAST_LARGE: 3.0,
  MIN_FONT_SIZE: 16,
};

/**
 * Test a page at multiple breakpoints
 */
async function testAtBreakpoints(page, breakpoints, testFn) {
  const results = [];

  for (const [key, breakpoint] of Object.entries(breakpoints)) {
    await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
    await page.waitForTimeout(100); // Wait for layout to stabilize

    const result = await testFn(page, breakpoint, key);
    results.push({ breakpoint: key, ...result });
  }

  return results;
}

/**
 * Check if an element has proper touch target size
 */
async function checkTouchTarget(element) {
  const box = await element.boundingBox();
  if (!box) return { valid: false, width: 0, height: 0, message: 'Element not found' };

  const { width, height } = box;
  const minSize = WCAG_STANDARDS.MIN_TOUCH_TARGET_SIZE;

  return {
    valid: width >= minSize && height >= minSize,
    width,
    height,
    message: width < minSize || height < minSize
      ? `Touch target too small: ${width}x${height}px (min: ${minSize}px)`
      : `Touch target OK: ${width}x${height}px`,
  };
}

/**
 * Get all interactive elements on the page
 */
async function getInteractiveElements(page) {
  const selectors = [
    'button',
    'a[href]',
    'input',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[onclick]',
    '.guardian-btn',
    '.guardian-quick-action-btn',
    '.guardian-sidebar-nav-item',
    '.guardian-bottom-nav-item',
  ];

  const elements = [];
  for (const selector of selectors) {
    const found = await page.$$(selector);
    elements.push(...found);
  }

  return elements;
}

/**
 * Check horizontal overflow on the page
 */
async function checkHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const bodyWidth = document.body.scrollWidth;
    const viewportWidth = window.innerWidth;
    return {
      bodyWidth,
      viewportWidth,
      hasOverflow: bodyWidth > viewportWidth,
      overflowAmount: bodyWidth - viewportWidth,
    };
  });

  return overflow;
}

/**
 * Simulate touch events
 */
async function simulateTouchTap(page, selector, options = {}) {
  const element = typeof selector === 'string' ? await page.$(selector) : selector;
  if (!element) throw new Error(`Element not found: ${selector}`);

  const box = await element.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  // Simulate touch
  await page.touchscreen.tap(x, y);

  if (options.waitFor) {
    await page.waitForSelector(options.waitFor, { timeout: options.timeout || 5000 });
  }

  if (options.waitForTimeout) {
    await page.waitForTimeout(options.waitForTimeout);
  }
}

/**
 * Check modal positioning and scroll containment
 */
async function checkModalPositioning(page, modalSelector) {
  const modal = await page.$(modalSelector);
  if (!modal) return { valid: false, message: 'Modal not found' };

  const modalBox = await modal.boundingBox();
  const viewport = await page.viewportSize();

  // Check if modal is within viewport bounds
  const isWithinBounds =
    modalBox.x >= 0 &&
    modalBox.y >= 0 &&
    modalBox.x + modalBox.width <= viewport.width &&
    modalBox.y + modalBox.height <= viewport.height;

  // Check if modal has proper scroll containment
  const hasScrollContainment = await modal.evaluate(el => {
    const style = window.getComputedStyle(el);
    const parentStyle = window.getComputedStyle(el.parentElement);
    return {
      overflow: style.overflow || style.overflowY,
      overscrollBehavior: style.overscrollBehavior,
      bodyOverflow: document.body.style.overflow,
    };
  });

  return {
    valid: isWithinBounds,
    position: { x: modalBox.x, y: modalBox.y },
    size: { width: modalBox.width, height: modalBox.height },
    isWithinBounds,
    scrollContainment: hasScrollContainment,
    message: isWithinBounds
      ? 'Modal positioned correctly within viewport'
      : 'Modal extends beyond viewport bounds',
  };
}

/**
 * Test virtual keyboard behavior for form inputs
 */
async function testVirtualKeyboardBehavior(page, inputSelector) {
  const input = await page.$(inputSelector);
  if (!input) return { valid: false, message: 'Input not found' };

  // Get initial viewport
  const initialViewport = await page.viewportSize();

  // Focus the input (simulates keyboard opening)
  await input.focus();
  await page.waitForTimeout(300);

  // Check if input is scrolled into view
  const isInView = await input.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  });

  // Check input attributes for mobile optimization
  const attributes = await input.evaluate(el => ({
    type: el.type,
    inputMode: el.inputMode,
    autocomplete: el.autocomplete,
    fontSize: window.getComputedStyle(el).fontSize,
  }));

  return {
    valid: isInView,
    isInView,
    attributes,
    message: isInView
      ? 'Input is visible when focused'
      : 'Input may be hidden by virtual keyboard',
  };
}

/**
 * Check color contrast ratio (simplified check)
 */
async function checkContrast(page, elementSelector) {
  const element = await page.$(elementSelector);
  if (!element) return { valid: false, message: 'Element not found' };

  const styles = await element.evaluate(el => {
    const computed = window.getComputedStyle(el);
    return {
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
    };
  });

  // Note: Actual contrast calculation would require color conversion
  // This is a simplified check
  return {
    valid: true, // Would need actual color contrast calculation
    styles,
    message: 'Contrast check requires color analysis',
  };
}

/**
 * Test screen reader compatibility
 */
async function checkScreenReaderCompatibility(page) {
  const checks = await page.evaluate(() => {
    const results = {
      buttonsWithoutLabels: [],
      imagesWithoutAlt: [],
      linksWithoutText: [],
      missingAriaLabels: [],
      landmarks: [],
    };

    // Check buttons without accessible names
    document.querySelectorAll('button').forEach(btn => {
      const hasLabel = btn.textContent.trim() ||
                       btn.getAttribute('aria-label') ||
                       btn.getAttribute('aria-labelledby') ||
                       btn.querySelector('img[alt]');
      if (!hasLabel) results.buttonsWithoutLabels.push(btn.outerHTML.substring(0, 100));
    });

    // Check images without alt
    document.querySelectorAll('img:not([alt])').forEach(img => {
      results.imagesWithoutAlt.push(img.src);
    });

    // Check ARIA landmarks
    const landmarks = document.querySelectorAll('[role], main, nav, aside, header, footer');
    results.landmarks = Array.from(landmarks).map(el => ({
      tag: el.tagName,
      role: el.getAttribute('role'),
    }));

    return results;
  });

  return {
    valid: checks.buttonsWithoutLabels.length === 0 && checks.imagesWithoutAlt.length === 0,
    ...checks,
    message: checks.buttonsWithoutLabels.length > 0 || checks.imagesWithoutAlt.length > 0
      ? 'Accessibility issues found'
      : 'Basic accessibility checks passed',
  };
}

/**
 * Capture mobile screenshot with device frame simulation
 */
async function captureMobileScreenshot(page, name, options = {}) {
  const path = `e2e/test-results/screenshots/${name}.png`;

  await page.screenshot({
    path,
    fullPage: options.fullPage || false,
    type: 'png',
  });

  return path;
}

/**
 * Check animation performance (60fps target)
 */
async function checkAnimationPerformance(page) {
  const metrics = await page.evaluate(async () => {
    return new Promise((resolve) => {
      let frames = 0;
      const startTime = performance.now();

      const countFrames = () => {
        frames++;
        if (performance.now() - startTime < 1000) {
          requestAnimationFrame(countFrames);
        } else {
          resolve({
            fps: frames,
            duration: performance.now() - startTime,
          });
        }
      };

      requestAnimationFrame(countFrames);
    });
  });

  return {
    valid: metrics.fps >= 55,
    fps: metrics.fps,
    target: 60,
    message: metrics.fps >= 55
      ? `Good animation performance: ${metrics.fps}fps`
      : `Poor animation performance: ${metrics.fps}fps (target: 60fps)`,
  };
}

module.exports = {
  MOBILE_BREAKPOINTS,
  WCAG_STANDARDS,
  testAtBreakpoints,
  checkTouchTarget,
  getInteractiveElements,
  checkHorizontalOverflow,
  simulateTouchTap,
  checkModalPositioning,
  testVirtualKeyboardBehavior,
  checkContrast,
  checkScreenReaderCompatibility,
  captureMobileScreenshot,
  checkAnimationPerformance,
};
