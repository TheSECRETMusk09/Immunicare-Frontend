const { expect, test } = require('@playwright/test');

const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
].join(', ');

const FATAL_TEXT_PATTERN =
  /Unhandled Runtime Error|Cannot read properties|Cannot set properties|TypeError:|ReferenceError:|SyntaxError:|Minified React error|Application error/i;

const LOADING_TEXT_PATTERN = /Loading|Please wait|Fetching|Saving|Processing/i;

const ACTION_PATTERN =
  /add|new|create|edit|delete|remove|view|details|record|book|approve|complete|cancel|save|submit|send|refresh|filter|search|export|print|download|upload/i;

const NON_DESTRUCTIVE_ACTION_PATTERN =
  /add|new|create|edit|view|details|record|book|refresh|filter|search/i;

const DESTRUCTIVE_ACTION_PATTERN =
  /delete|remove|approve|complete|cancel appointment|save|submit|send|logout|export|print|download|upload/i;

const DEFAULT_ADMIN_CREDENTIALS = [
  {
    username: process.env.QA_ADMIN_USERNAME || process.env.QA_ADMIN_EMAIL,
    password: process.env.QA_ADMIN_PASSWORD,
  },
  {
    username: process.env.TEST_ADMIN_USERNAME || process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
  },
  {
    username: process.env.ADMIN_USERNAME || process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  },
  { username: 'administrator', password: 'Admin2024!' },
  { username: 'admin', password: 'Admin2024!' },
  { username: 'defense.admin', password: 'AdminDemo2026!' },
  { username: 'defense.admin@demo-immunicare.ph', password: 'AdminDemo2026!' },
];

const DEFAULT_GUARDIAN_CREDENTIALS = [
  {
    username: process.env.QA_GUARDIAN_USERNAME || process.env.QA_GUARDIAN_EMAIL,
    password: process.env.QA_GUARDIAN_PASSWORD,
  },
  {
    username: process.env.TEST_GUARDIAN_EMAIL || process.env.TEST_GUARDIAN_USERNAME,
    password: process.env.TEST_GUARDIAN_PASSWORD,
  },
  { username: 'guardian@test.com', password: 'password123' },
];

function envFlag(name, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function compactWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function safeAttachmentName(value) {
  return compactWhitespace(value).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80) || 'qa';
}

function uniqueCredentialSets(role) {
  const source = role === 'admin' ? DEFAULT_ADMIN_CREDENTIALS : DEFAULT_GUARDIAN_CREDENTIALS;
  const seen = new Set();
  return source
    .filter((credential) => credential.username && credential.password)
    .filter((credential) => {
      const key = `${credential.username}::${credential.password}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function firstVisibleLocator(page, selectors, label) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < Math.min(count, 8); index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible({ timeout: 500 }).catch(() => false)) {
        return candidate;
      }
    }
  }

  throw new Error(`Unable to find visible ${label} using selectors: ${selectors.join(', ')}`);
}

async function fillFirstVisible(page, selectors, value, label) {
  const locator = await firstVisibleLocator(page, selectors, label);
  await locator.fill(String(value));
  return locator;
}

async function clickFirstVisible(page, selectors, label) {
  const locator = await firstVisibleLocator(page, selectors, label);
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click();
  return locator;
}

async function clearBrowserSession(page) {
  await page.context().clearCookies().catch(() => {});
  await page.goto('about:blank');
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch (_error) {
      // The blank page can run before storage exists in some browsers.
    }
  });
}

function isLoginUrl(url) {
  try {
    return /\/(admin\/login|guardian\/login|login)$/i.test(new URL(url).pathname);
  } catch (_error) {
    return /login/i.test(String(url));
  }
}

async function loginAs(page, role, testInfo) {
  const loginPath = role === 'admin' ? '/admin/login' : '/guardian/login';
  const dashboardPath = role === 'admin' ? '/analytics' : '/guardian/dashboard';
  const credentials = uniqueCredentialSets(role);

  await clearBrowserSession(page);

  const errors = [];
  for (const credential of credentials) {
    await page.goto(loginPath, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const usernameSelectors =
      role === 'admin'
        ? [
            'input[name="admin_user"]',
            'input[name="username"]',
            'input[type="email"]',
            'input[type="text"]',
          ]
        : [
            'input[name="guardian_id"]',
            'input[name="username"]',
            'input[name="email"]',
            'input[type="email"]',
            'input[type="text"]',
          ];

    try {
      await fillFirstVisible(page, usernameSelectors, credential.username, `${role} username`);
      await fillFirstVisible(
        page,
        ['input[name="password"]', 'input[type="password"]'],
        credential.password,
        `${role} password`,
      );

      await clickFirstVisible(
        page,
        ['button[type="submit"]', 'button:has-text("Sign In")', 'button:has-text("Login")'],
        `${role} login submit`,
      );
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(500);

      const currentUrl = page.url();
      const invalidMessageVisible =
        (await page
          .locator('text=/invalid|incorrect|failed|required|verify your username/i')
          .first()
          .isVisible({ timeout: 500 })
          .catch(() => false)) || false;

      if (!isLoginUrl(currentUrl) && !invalidMessageVisible) {
        testInfo?.annotations.push({
          type: 'qa-login',
          description: `${role} login succeeded with ${credential.username}`,
        });
        await page.goto(dashboardPath, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForLoadState('networkidle').catch(() => {});
        return credential;
      }

      errors.push(`${credential.username}: stayed on login page`);
    } catch (error) {
      errors.push(`${credential.username}: ${error.message}`);
    }
  }

  throw new Error(
    `Unable to login as ${role}. Set QA_${role.toUpperCase()}_USERNAME and QA_${role.toUpperCase()}_PASSWORD. Attempts: ${errors.join('; ')}`,
  );
}

function attachDiagnostics(page, testInfo) {
  const consoleErrors = [];
  const pageErrors = [];
  const serverErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      if (!/ResizeObserver loop limit exceeded|favicon\.ico/i.test(text)) {
        consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.stack || error.message);
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status >= 500) {
      serverErrors.push(`${status} ${response.url()}`);
    }
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const url = request.url();
    if (/\/api\//i.test(url)) {
      failedRequests.push(`${failure?.errorText || 'request failed'} ${url}`);
    }
  });

  return {
    async assertClean(label) {
      await page.waitForTimeout(250);
      const failures = [
        ...pageErrors.map((entry) => `pageerror: ${entry}`),
        ...serverErrors.map((entry) => `server: ${entry}`),
        ...consoleErrors.map((entry) => `console: ${entry}`),
      ];

      if (envFlag('QA_FAIL_REQUEST_FAILURES')) {
        failures.push(...failedRequests.map((entry) => `request: ${entry}`));
      }

      if (failures.length > 0) {
        await testInfo.attach(`${safeAttachmentName(label)}-diagnostics.json`, {
          contentType: 'application/json',
          body: Buffer.from(
            JSON.stringify(
              {
                label,
                url: page.url(),
                consoleErrors,
                pageErrors,
                serverErrors,
                failedRequests,
              },
              null,
              2,
            ),
          ),
        });
      }

      expect.soft(failures, `${label} should have no page crashes, console errors, or backend 5xx responses`).toEqual([]);
    },
  };
}

async function assertNoAppCrash(page, label) {
  await expect(page.locator('body'), `${label} body should render`).toBeVisible();
  const fatalText = page.locator(`text=${FATAL_TEXT_PATTERN}`);
  await expect.soft(fatalText, `${label} should not show a fatal runtime error`).toHaveCount(0);
}

async function assertNoStaleLoading(page, label) {
  await page.waitForTimeout(500);
  const staleLoadingCount = await page
    .locator(`text=${LOADING_TEXT_PATTERN}`)
    .evaluateAll((nodes) =>
      nodes.filter((node) => {
        const text = String(node.textContent || '').trim();
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return text && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      }).length,
    )
    .catch(() => 0);

  expect.soft(staleLoadingCount, `${label} should not leave permanent loading text after data settles`).toBeLessThanOrEqual(2);
}

async function navigateAndAssertLoaded(page, module, testInfo) {
  await test.step(`Open ${module.name}`, async () => {
    await page.goto(module.path, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await assertNoAppCrash(page, module.name);

    expect.soft(isLoginUrl(page.url()), `${module.name} should be accessible after role login`).toBe(false);

    const visibleShell = page
      .locator('main, [role="main"], h1, h2, h3, table, form, [class*="dashboard"], [class*="page"]')
      .first();
    await expect.soft(visibleShell, `${module.name} should render visible page content`).toBeVisible();

    await assertNoStaleLoading(page, module.name);
  });

  testInfo.annotations.push({ type: 'qa-route', description: `${module.name}: ${module.path}` });
}

async function visiblePageText(page) {
  return compactWhitespace(
    await page.locator('body').evaluate((body) => body.innerText || body.textContent || '').catch(() => ''),
  );
}

async function assertExpectedContent(page, module) {
  const bodyText = await visiblePageText(page);
  const missing = (module.expectedText || []).filter((text) => !new RegExp(text, 'i').test(bodyText));
  expect.soft(missing, `${module.name} should expose expected module labels`).toEqual([]);
}

async function getVisibleControls(page, options = {}) {
  const includeNavigation = Boolean(options.includeNavigation);
  return page.evaluate(
    ({ selector, includeNavigation: shouldIncludeNavigation }) => {
      function textOf(node) {
        const labelledBy = node.getAttribute('aria-labelledby');
        const escapeId = (value) =>
          window.CSS && typeof window.CSS.escape === 'function'
            ? window.CSS.escape(value)
            : String(value).replace(/"/g, '\\"');
        const labelledByText = labelledBy
          ? labelledBy
              .split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent || '')
              .join(' ')
          : '';
        const associatedLabel =
          node.id && document.querySelector(`label[for="${escapeId(node.id)}"]`)
            ? document.querySelector(`label[for="${escapeId(node.id)}"]`).textContent
            : '';
        const wrappingLabel = node.closest('label')?.textContent || '';
        const imageAlt = node.querySelector?.('img[alt]')?.getAttribute('alt') || '';
        return [
          node.getAttribute('aria-label'),
          labelledByText,
          associatedLabel,
          wrappingLabel,
          node.getAttribute('title'),
          node.getAttribute('placeholder'),
          node.value,
          node.textContent,
          imageAlt,
        ]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      function isVisible(node) {
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity || 1) !== 0 &&
          rect.width > 0 &&
          rect.height > 0 &&
          !node.closest('[aria-hidden="true"]')
        );
      }

      return Array.from(document.querySelectorAll(selector))
        .map((node, index) => ({ node, index }))
        .filter(({ node }) => isVisible(node))
        .filter(({ node }) => shouldIncludeNavigation || !node.closest('nav, aside, header, footer'))
        .map(({ node, index }) => {
          const rect = node.getBoundingClientRect();
          return {
            index,
            tag: node.tagName.toLowerCase(),
            role: node.getAttribute('role') || '',
            type: node.getAttribute('type') || '',
            name: textOf(node),
            disabled: Boolean(node.disabled || node.getAttribute('aria-disabled') === 'true'),
            required: Boolean(node.required || node.getAttribute('aria-required') === 'true'),
            href: node.getAttribute('href') || '',
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          };
        });
    },
    { selector: INTERACTIVE_SELECTOR, includeNavigation },
  );
}

async function auditInteractiveElements(page, module, testInfo) {
  const controls = await getVisibleControls(page, { includeNavigation: true });
  const violations = controls
    .filter((control) => !control.disabled)
    .filter((control) => !control.name)
    .map((control) => `${control.tag}${control.role ? `[role=${control.role}]` : ''} at ${control.rect.x},${control.rect.y}`);

  const duplicateIds = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll('[id]')).map((node) => node.id).filter(Boolean);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });

  await testInfo.attach(`${safeAttachmentName(module.name)}-controls.json`, {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify({ url: page.url(), controls, duplicateIds }, null, 2)),
  });

  expect.soft(violations, `${module.name} should label every visible interactive element`).toEqual([]);
  expect.soft([...new Set(duplicateIds)], `${module.name} should not render duplicate DOM ids`).toEqual([]);
}

async function assertExpectedControls(page, module) {
  const controls = await getVisibleControls(page, { includeNavigation: false });
  const names = controls.map((control) => control.name).join(' | ');
  const missing = (module.expectedControls || []).filter((pattern) => !pattern.test(names));
  expect.soft(missing.map(String), `${module.name} should expose expected actions/controls`).toEqual([]);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function clickVisibleControl(page, matcher, options = {}) {
  const controls = await getVisibleControls(page, { includeNavigation: Boolean(options.includeNavigation) });
  const found = controls.find((control) => !control.disabled && matcher.test(control.name));
  if (!found) return null;

  const locator = page.locator(INTERACTIVE_SELECTOR).nth(found.index);
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click({ timeout: options.timeout || 5000 });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(options.settleMs || 300);
  return found;
}

async function closeOverlayIfOpen(page) {
  const closeSelectors = [
    '[role="dialog"] button:has-text("Cancel")',
    '[role="dialog"] button:has-text("Close")',
    '[role="dialog"] button[aria-label*="Close" i]',
    '.modal button:has-text("Cancel")',
    '.modal button:has-text("Close")',
    'button:has-text("Cancel")',
    'button[aria-label*="Close" i]',
  ];

  for (const selector of closeSelectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible({ timeout: 300 }).catch(() => false)) {
      await locator.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
      return true;
    }
  }

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  return false;
}

async function auditFormsOnPage(page, module, testInfo) {
  const forms = await page.evaluate(() => {
    function isVisible(node) {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }

    function fieldName(field) {
      const escapeId = (value) =>
        window.CSS && typeof window.CSS.escape === 'function'
          ? window.CSS.escape(value)
          : String(value).replace(/"/g, '\\"');
      const label =
        (field.id && document.querySelector(`label[for="${escapeId(field.id)}"]`)?.textContent) ||
        field.closest('label')?.textContent ||
        field.getAttribute('aria-label') ||
        field.getAttribute('placeholder') ||
        field.getAttribute('name') ||
        '';
      return label.replace(/\s+/g, ' ').trim();
    }

    const containers = Array.from(document.querySelectorAll('form, [role="dialog"], main, [role="main"]')).filter(isVisible);
    return containers.slice(0, 6).map((container, containerIndex) => {
      const fields = Array.from(container.querySelectorAll('input:not([type="hidden"]), select, textarea')).filter(isVisible);
      const submitButtons = Array.from(
        container.querySelectorAll('button[type="submit"], button, input[type="submit"]'),
      )
        .filter(isVisible)
        .map((button) => (button.textContent || button.value || button.getAttribute('aria-label') || '').trim());

      return {
        containerIndex,
        fieldCount: fields.length,
        submitButtons,
        fields: fields.map((field) => ({
          tag: field.tagName.toLowerCase(),
          type: field.getAttribute('type') || '',
          name: field.getAttribute('name') || '',
          label: fieldName(field),
          required: Boolean(field.required || field.getAttribute('aria-required') === 'true'),
          minLength: field.getAttribute('minlength') || '',
          maxLength: field.getAttribute('maxlength') || '',
          pattern: field.getAttribute('pattern') || '',
          inputMode: field.getAttribute('inputmode') || '',
        })),
      };
    });
  });

  const unlabeledFields = forms.flatMap((form) =>
    form.fields
      .filter((field) => !field.label && field.type !== 'checkbox' && field.type !== 'radio')
      .map((field) => `${field.tag}[name="${field.name}"]`),
  );

  await testInfo.attach(`${safeAttachmentName(module.name)}-form-audit.json`, {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify({ url: page.url(), forms }, null, 2)),
  });

  expect.soft(unlabeledFields, `${module.name} should label visible form fields`).toEqual([]);
}

async function exerciseModuleTabs(page, module) {
  for (const tabName of module.tabs || []) {
    await test.step(`${module.name}: exercise ${tabName} tab/control`, async () => {
      const matcher = new RegExp(escapeRegExp(tabName), 'i');
      const clicked = await clickVisibleControl(page, matcher, { includeNavigation: false, settleMs: 500 });
      if (!clicked) {
        expect.soft(clicked, `${module.name} should expose ${tabName}`).not.toBeNull();
        return;
      }
      await assertNoAppCrash(page, `${module.name} ${tabName}`);
      await assertNoStaleLoading(page, `${module.name} ${tabName}`);
    });
  }
}

async function auditActionControls(page, module, testInfo, options = {}) {
  const actionLimit = options.actionLimit || 6;
  const controls = await getVisibleControls(page, { includeNavigation: false });
  const actionControls = controls.filter((control) => ACTION_PATTERN.test(control.name));

  await testInfo.attach(`${safeAttachmentName(module.name)}-actions.json`, {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify({ url: page.url(), actionControls }, null, 2)),
  });

  expect.soft(actionControls.length, `${module.name} should expose auditable action controls`).toBeGreaterThan(0);

  const openableControls = actionControls
    .filter((control) => NON_DESTRUCTIVE_ACTION_PATTERN.test(control.name))
    .filter((control) => !DESTRUCTIVE_ACTION_PATTERN.test(control.name))
    .slice(0, actionLimit);

  const startingUrl = page.url();

  for (const control of openableControls) {
    await test.step(`${module.name}: action ${control.name}`, async () => {
      const matcher = new RegExp(escapeRegExp(control.name), 'i');
      const clicked = await clickVisibleControl(page, matcher, { includeNavigation: false, settleMs: 400 }).catch((error) => {
        expect.soft(error.message, `${module.name} action ${control.name} should be clickable`).toBe('');
        return null;
      });

      if (!clicked) {
        return;
      }

      await assertNoAppCrash(page, `${module.name} after ${control.name}`);
      await auditFormsOnPage(page, { name: `${module.name}-${control.name}` }, testInfo);

      if (envFlag('QA_ENABLE_FORM_SUBMIT_VALIDATION')) {
        await validateEmptySubmitIfSafe(page, `${module.name} ${control.name}`);
      }

      if (page.url() !== startingUrl) {
        await page.goto(startingUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForLoadState('networkidle').catch(() => {});
      } else {
        await closeOverlayIfOpen(page);
      }
    });
  }
}

async function validateEmptySubmitIfSafe(page, label) {
  const dialogOrForm = page.locator('[role="dialog"], form').first();
  if (!(await dialogOrForm.isVisible({ timeout: 500 }).catch(() => false))) {
    return;
  }

  const hasFilledRequiredField = await dialogOrForm
    .locator('input[required], select[required], textarea[required], [aria-required="true"]')
    .evaluateAll((fields) =>
      fields.some((field) => {
        if (field.type === 'checkbox' || field.type === 'radio') return field.checked;
        return String(field.value || '').trim().length > 0;
      }),
    )
    .catch(() => false);

  if (hasFilledRequiredField) {
    return;
  }

  const submit = dialogOrForm.locator('button[type="submit"], input[type="submit"], button:has-text("Save"), button:has-text("Submit")').first();
  if (!(await submit.isVisible({ timeout: 500 }).catch(() => false))) {
    return;
  }

  await submit.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);

  const validationTextCount = await page.locator('text=/required|invalid|please|must|cannot|error/i').count().catch(() => 0);
  const invalidFieldCount = await page
    .locator('[aria-invalid="true"], input:invalid, select:invalid, textarea:invalid')
    .count()
    .catch(() => 0);
  const validationCount = validationTextCount + invalidFieldCount;
  expect.soft(validationCount, `${label} should surface validation before saving incomplete data`).toBeGreaterThan(0);
}

async function assertUnauthenticatedRedirect(page, protectedPath, expectedLoginPattern) {
  await clearBrowserSession(page);
  await page.goto(protectedPath, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect.soft(page, `${protectedPath} should redirect unauthenticated users`).toHaveURL(expectedLoginPattern);
}

async function assertCrossRoleBlocked(page, loginRole, blockedPath, expectedAllowedPattern, testInfo) {
  await loginAs(page, loginRole, testInfo);
  await page.goto(blockedPath, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);
  await expect.soft(page, `${loginRole} should not access ${blockedPath}`).toHaveURL(expectedAllowedPattern);
}

async function auditCrudContract(page, module, testInfo, options = {}) {
  const controls = await getVisibleControls(page, { includeNavigation: false });
  const names = controls.map((control) => control.name).join(' | ');
  const missing = [];

  for (const [operation, patterns] of Object.entries(module.crud || {})) {
    const normalizedPatterns = Array.isArray(patterns) ? patterns : [patterns];
    const supported = normalizedPatterns.some((pattern) => pattern.test(names));
    if (!supported) {
      missing.push(`${operation}: ${normalizedPatterns.map(String).join(' or ')}`);
    }
  }

  await testInfo.attach(`${safeAttachmentName(module.name)}-crud-contract.json`, {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify({ url: page.url(), controls, crud: module.crud || {}, missing }, null, 2)),
  });

  expect.soft(missing, `${module.name} should expose all declared CRUD controls`).toEqual([]);

  if (!options.openMutationSurfaces) {
    return;
  }

  const createPatterns = module.crud?.create ? (Array.isArray(module.crud.create) ? module.crud.create : [module.crud.create]) : [];
  const updatePatterns = module.crud?.update ? (Array.isArray(module.crud.update) ? module.crud.update : [module.crud.update]) : [];

  for (const [operation, patterns] of [
    ['create', createPatterns],
    ['update', updatePatterns],
  ]) {
    const pattern = patterns.find(Boolean);
    if (!pattern) continue;

    await test.step(`${module.name}: open ${operation} form`, async () => {
      const clicked = await clickVisibleControl(page, pattern, { includeNavigation: false, settleMs: 500 });
      if (!clicked) {
        expect.soft(clicked, `${module.name} should open ${operation} form`).not.toBeNull();
        return;
      }

      await assertNoAppCrash(page, `${module.name} ${operation}`);
      await auditFormsOnPage(page, { name: `${module.name}-${operation}` }, testInfo);
      await closeOverlayIfOpen(page);
      await page.goto(module.path, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
    });
  }

  if (options.openDeleteConfirmations && module.crud?.delete) {
    const deletePatterns = Array.isArray(module.crud.delete) ? module.crud.delete : [module.crud.delete];
    const pattern = deletePatterns.find(Boolean);
    await test.step(`${module.name}: open delete/deactivate confirmation`, async () => {
      const clicked = await clickVisibleControl(page, pattern, { includeNavigation: false, settleMs: 500 });
      if (!clicked) {
        expect.soft(clicked, `${module.name} should expose delete/deactivate confirmation`).not.toBeNull();
        return;
      }

      await assertNoAppCrash(page, `${module.name} delete confirmation`);
      const confirmationVisible = await page
        .locator('text=/confirm|are you sure|delete|deactivate|cancel/i')
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      expect.soft(confirmationVisible, `${module.name} delete/deactivate should require confirmation`).toBe(true);
      await closeOverlayIfOpen(page);
      await page.goto(module.path, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
    });
  }
}

module.exports = {
  attachDiagnostics,
  auditCrudContract,
  assertCrossRoleBlocked,
  assertExpectedContent,
  assertExpectedControls,
  assertNoAppCrash,
  assertUnauthenticatedRedirect,
  auditActionControls,
  auditFormsOnPage,
  auditInteractiveElements,
  envFlag,
  exerciseModuleTabs,
  getVisibleControls,
  loginAs,
  navigateAndAssertLoaded,
};
