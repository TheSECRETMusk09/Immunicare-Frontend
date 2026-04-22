/**
 * San Nicolas Admin and Guardian End-to-End QA Suite
 *
 * This suite intentionally does not modify UI components, routes, styling, or
 * app logic. It audits the live dashboards from the browser boundary and
 * reports route, control, form, permission, state, and backend response issues.
 *
 * Normal run:
 *   QA_RUN_COMPREHENSIVE=true npx playwright test e2e/tests/admin-guardian-comprehensive-qa.spec.js
 *
 * Optional empty-submit validation:
 *   QA_RUN_COMPREHENSIVE=true QA_ENABLE_FORM_SUBMIT_VALIDATION=true npx playwright test e2e/tests/admin-guardian-comprehensive-qa.spec.js
 */

if (require.main === module) {
  console.error(
    [
      'This file is a Playwright test spec and cannot be run with plain node.',
      '',
      'Run it from the frontend folder with:',
      '  npm run e2e:san-nicolas',
      '',
      'Or directly with:',
      '  npx playwright test e2e/tests/admin-guardian-comprehensive-qa.spec.js --project="Tablet - iPad Air (820x1180)"',
    ].join('\n'),
  );
  process.exit(1);
}

const { test, expect } = require('@playwright/test');
const {
  attachDiagnostics,
  assertCrossRoleBlocked,
  assertExpectedContent,
  assertExpectedControls,
  assertUnauthenticatedRedirect,
  auditActionControls,
  auditCrudContract,
  auditFormsOnPage,
  auditInteractiveElements,
  envFlag,
  exerciseModuleTabs,
  loginAs,
  navigateAndAssertLoaded,
} = require('../utils/comprehensive-qa-helpers');

const ADMIN_MODULES = [
  {
    name: 'Admin Analytics Dashboard',
    path: '/analytics',
    expectedText: ['Analytics|Dashboard'],
    expectedControls: [/refresh|filter|month|date|report|export/i],
    tabs: ['This Month'],
  },
  {
    name: 'Admin Infant Management',
    path: '/infants',
    expectedText: ['Infant Management', 'Registered Infants|Transfer-In Cases'],
    expectedControls: [/add|register|infant/i, /personal|view/i, /schedule/i, /records/i, /chart/i],
    tabs: ['Personal', 'Schedule', 'Records', 'Chart', 'Transfer-In Cases'],
  },
  {
    name: 'Admin Vaccination Records',
    path: '/vaccination-management',
    expectedText: ['Vaccination Records|Vaccination Tracking|Vaccination Schedule'],
    expectedControls: [/Vaccination Records/i, /Vaccination Tracking/i, /Vaccination Schedule/i],
    tabs: ['Vaccination Records', 'Vaccination Tracking', 'Vaccination Schedule', 'This Month'],
  },
  {
    name: 'Admin Appointments',
    path: '/appointments',
    expectedText: ['Appointments'],
    expectedControls: [/new|schedule|book|appointment/i, /calendar|list/i],
    tabs: ['Calendar', 'List', 'Pending', 'Scheduled', 'Completed'],
  },
  {
    name: 'Admin Inventory',
    path: '/inventory',
    expectedText: ['Inventory'],
    expectedControls: [/transaction|stock|movement|supplier|alert|report|add/i],
    tabs: ['Stock', 'Transactions', 'Alerts', 'Reports', 'Suppliers'],
  },
  {
    name: 'Admin Users',
    path: '/users',
    expectedText: ['User|Guardian|Admin|Health Worker'],
    expectedControls: [/add|new|create|guardian|staff|admin/i, /edit|reset|view/i],
    tabs: ['Guardians', 'Staff', 'Admins', 'Health Workers'],
  },
  {
    name: 'Admin Reports',
    path: '/reports',
    expectedText: ['Reports'],
    expectedControls: [/generate|export|download|filter|report/i],
    tabs: ['Vaccination', 'Inventory', 'Appointment'],
  },
  {
    name: 'Admin Announcements',
    path: '/announcements',
    expectedText: ['Announcement'],
    expectedControls: [/add|create|new|edit|delete|publish/i],
    tabs: ['Active', 'Draft', 'Archived'],
  },
  {
    name: 'Admin Notifications',
    path: '/notifications',
    expectedText: ['Notifications'],
    expectedControls: [/send|create|filter|mark|refresh|settings/i],
    tabs: ['All', 'Unread', 'Appointments', 'Vaccinations'],
  },
  {
    name: 'Admin Health Information',
    path: '/health-information',
    expectedText: ['Health Information|Growth|Measurements'],
    expectedControls: [/add|record|filter|search|view/i],
    tabs: ['Growth', 'Measurements', 'History'],
  },
  {
    name: 'Admin Profile',
    path: '/profile',
    expectedText: ['Profile'],
    expectedControls: [/edit|save|change|password/i],
    tabs: ['Profile', 'Security'],
  },
  {
    name: 'Admin Digital Immunization Chart',
    path: '/digital-papers/immunization-chart',
    expectedText: ['Immunization Chart|Record Visit|Search|Child'],
    expectedControls: [/search|record|print|download|view/i],
    tabs: ['Record Visit', 'Print', 'Download'],
  },
  {
    name: 'Admin Digital Immunization Records',
    path: '/digital-papers/immunization-records',
    expectedText: ['Immunization Record|Booklet|Search|Child'],
    expectedControls: [/search|print|download|view|records/i],
    tabs: ['Print', 'Download'],
  },
  {
    name: 'Admin Digital Vaccine Schedule',
    path: '/digital-papers/vaccine-schedule',
    expectedText: ['Vaccine Schedule|Booklet|Search|Child'],
    expectedControls: [/search|print|download|view|schedule/i],
    tabs: ['Print', 'Download'],
  },
];

const GUARDIAN_MODULES = [
  {
    name: 'Guardian Dashboard',
    path: '/guardian/dashboard',
    expectedText: ['Dashboard|Appointments|Children|Vaccination'],
    expectedControls: [/appointment|children|record|refresh|view/i],
    tabs: ['Appointments', 'Records', 'Children'],
  },
  {
    name: 'Guardian My Children',
    path: '/guardian/children',
    expectedText: ['My Children|Children'],
    expectedControls: [/add|child|book|appointment|view|edit|refresh/i],
    tabs: ['Book Appointment', 'Records', 'Health Chart'],
  },
  {
    name: 'Guardian Appointments',
    path: '/guardian/appointments',
    expectedText: ['Appointments'],
    expectedControls: [/book|new|view|cancel|calendar|list/i],
    tabs: ['Calendar', 'List', 'Pending', 'Scheduled', 'Completed'],
  },
  {
    name: 'Guardian Appointment Booking',
    path: '/guardian/appointments/new',
    expectedText: ['Book|Appointment|Child|Date'],
    expectedControls: [/book|submit|cancel|date|child/i],
    tabs: ['Date', 'Time'],
  },
  {
    name: 'Guardian Vaccination Records',
    path: '/guardian/vaccination-records',
    expectedText: ['Vaccination Records|Immunization|Child'],
    expectedControls: [/booklet|appointment|refresh|view|print|download/i],
    tabs: ['Booklet', 'Appointment'],
  },
  {
    name: 'Guardian Immunization Chart',
    path: '/guardian/immunization-chart',
    expectedText: ['Immunization Chart|Child'],
    expectedControls: [/view|print|download|refresh/i],
    tabs: ['Print', 'Download'],
  },
  {
    name: 'Guardian Documents',
    path: '/guardian/documents',
    expectedText: ['Documents|Vaccination Records|Appointments'],
    expectedControls: [/view|open|download|book/i],
    tabs: ['Vaccination Records', 'Appointments'],
  },
  {
    name: 'Guardian Messages',
    path: '/guardian/messages',
    expectedText: ['Messages|Inbox|Conversation'],
    expectedControls: [/send|compose|view|search|refresh/i],
    tabs: ['Inbox', 'Sent'],
  },
  {
    name: 'Guardian Notifications',
    path: '/guardian/notifications',
    expectedText: ['Notifications'],
    expectedControls: [/mark|read|filter|view|refresh/i],
    tabs: ['All', 'Unread', 'Appointments', 'Vaccinations'],
  },
  {
    name: 'Guardian Profile',
    path: '/guardian/profile',
    expectedText: ['Profile'],
    expectedControls: [/edit|save|change|password|download/i],
    tabs: ['Profile', 'Security', 'Notifications'],
  },
  {
    name: 'Guardian Health Information',
    path: '/guardian/health-information',
    expectedText: ['Health Information|Growth|Measurements'],
    expectedControls: [/view|appointment|chart|refresh/i],
    tabs: ['Growth', 'Measurements'],
  },
];

const ACTION_AUDIT_ADMIN_MODULES = ADMIN_MODULES.filter((module) =>
  /Infant|Vaccination|Appointments|Inventory|Users|Reports|Announcements|Notifications/.test(module.name),
);

const ACTION_AUDIT_GUARDIAN_MODULES = GUARDIAN_MODULES.filter((module) =>
  /Children|Appointments|Vaccination|Chart|Documents|Notifications|Profile/.test(module.name),
);

const CRUD_CONTRACT_MODULES = [
  {
    role: 'admin',
    name: 'Admin Infant Management CRUD',
    path: '/infants',
    expectedText: ['Infant Management'],
    crud: {
      create: [/add.*infant|register.*infant|new.*infant/i],
      read: [/view|personal|records|schedule|chart/i],
      update: [/edit|update/i],
      delete: [/delete|deactivate|archive/i],
      search: [/search|filter/i],
    },
  },
  {
    role: 'admin',
    name: 'Admin Vaccination Management CRUD',
    path: '/vaccination-management',
    expectedText: ['Vaccination Records|Vaccination Tracking|Vaccination Schedule'],
    crud: {
      create: [/add.*vaccination|new.*vaccination|record.*vaccination/i],
      read: [/view|records|tracking|schedule/i],
      update: [/edit|update|record/i],
      delete: [/delete|remove|void|cancel/i],
      search: [/search|filter|month|date/i],
    },
  },
  {
    role: 'admin',
    name: 'Admin Appointments CRUD',
    path: '/appointments',
    expectedText: ['Appointments'],
    crud: {
      create: [/new.*appointment|schedule.*appointment|book.*appointment/i],
      read: [/view|details|calendar|list/i],
      update: [/edit|approve|complete|reschedule/i],
      delete: [/cancel|delete/i],
      search: [/search|filter|date/i],
    },
  },
  {
    role: 'admin',
    name: 'Admin Inventory CRUD',
    path: '/inventory',
    expectedText: ['Inventory'],
    crud: {
      create: [/add|new|transaction|receive|stock movement/i],
      read: [/view|details|stock|transactions|reports/i],
      update: [/edit|adjust|update/i],
      delete: [/delete|remove|deactivate|archive/i],
      search: [/search|filter|category|status/i],
    },
  },
  {
    role: 'admin',
    name: 'Admin User Management CRUD',
    path: '/users',
    expectedText: ['User|Guardian|Admin|Health Worker'],
    crud: {
      create: [/add.*user|add.*guardian|add.*staff|create/i],
      read: [/view|details|guardian|staff|admin/i],
      update: [/edit|reset password|update/i],
      delete: [/delete|deactivate|disable|archive/i],
      search: [/search|filter|role/i],
    },
  },
  {
    role: 'admin',
    name: 'Admin Reports CRUD',
    path: '/reports',
    expectedText: ['Reports'],
    crud: {
      create: [/generate|create.*report/i],
      read: [/view|preview|report/i],
      update: [/filter|date|period|type/i],
      delete: [/clear|reset/i],
      search: [/filter|search|date|period/i],
    },
  },
  {
    role: 'admin',
    name: 'Admin Announcements CRUD',
    path: '/announcements',
    expectedText: ['Announcement'],
    crud: {
      create: [/add|create|new.*announcement/i],
      read: [/view|details|active|draft|archived/i],
      update: [/edit|publish|update/i],
      delete: [/delete|archive|remove/i],
      search: [/search|filter|status/i],
    },
  },
  {
    role: 'admin',
    name: 'Admin Notifications CRUD',
    path: '/notifications',
    expectedText: ['Notifications'],
    crud: {
      create: [/send|create|new.*notification/i],
      read: [/view|all|unread|read/i],
      update: [/mark|settings|edit/i],
      delete: [/delete|remove|clear/i],
      search: [/search|filter|type/i],
    },
  },
  {
    role: 'guardian',
    name: 'Guardian Children CRUD',
    path: '/guardian/children',
    expectedText: ['My Children|Children'],
    crud: {
      create: [/add.*child|register.*child|new.*child/i],
      read: [/view|records|health chart|details/i],
      update: [/edit|update/i],
      delete: [/delete|remove|deactivate/i],
      search: [/search|filter/i],
    },
  },
  {
    role: 'guardian',
    name: 'Guardian Appointment CRUD',
    path: '/guardian/appointments',
    expectedText: ['Appointments'],
    crud: {
      create: [/book|new.*appointment|schedule/i],
      read: [/view|details|calendar|list/i],
      update: [/edit|reschedule/i],
      delete: [/cancel|delete/i],
      search: [/search|filter|date/i],
    },
  },
  {
    role: 'guardian',
    name: 'Guardian Profile CRUD',
    path: '/guardian/profile',
    expectedText: ['Profile'],
    crud: {
      create: [/add.*phone|add.*contact/i],
      read: [/view|profile|security|notifications/i],
      update: [/edit|save|change password|update/i],
      delete: [/delete|remove/i],
      search: [/filter|settings/i],
    },
  },
];

test.describe('San Nicolas Admin and Guardian comprehensive QA @san-nicolas-qa', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach((_, testInfo) => {
    testInfo.skip(
      !envFlag('QA_RUN_COMPREHENSIVE'),
      'Set QA_RUN_COMPREHENSIVE=true to run the full San Nicolas QA suite.',
    );
  });

  test.use({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });

  test('Admin dashboard route, control, form, and backend response audit', async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const diagnostics = attachDiagnostics(page, testInfo);
    await loginAs(page, 'admin', testInfo);

    for (const module of ADMIN_MODULES) {
      await navigateAndAssertLoaded(page, module, testInfo);
      await assertExpectedContent(page, module);
      await assertExpectedControls(page, module);
      await auditInteractiveElements(page, module, testInfo);
      await auditFormsOnPage(page, module, testInfo);
      await exerciseModuleTabs(page, module);
      await diagnostics.assertClean(module.name);
    }
  });

  test('Guardian dashboard route, control, form, and backend response audit', async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const diagnostics = attachDiagnostics(page, testInfo);
    await loginAs(page, 'guardian', testInfo);

    for (const module of GUARDIAN_MODULES) {
      await navigateAndAssertLoaded(page, module, testInfo);
      await assertExpectedContent(page, module);
      await assertExpectedControls(page, module);
      await auditInteractiveElements(page, module, testInfo);
      await auditFormsOnPage(page, module, testInfo);
      await exerciseModuleTabs(page, module);
      await diagnostics.assertClean(module.name);
    }
  });

  test('Action buttons, modal openings, and validation surfaces remain responsive', async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const diagnostics = attachDiagnostics(page, testInfo);

    await loginAs(page, 'admin', testInfo);
    for (const module of ACTION_AUDIT_ADMIN_MODULES) {
      await navigateAndAssertLoaded(page, module, testInfo);
      await auditActionControls(page, module, testInfo, { actionLimit: 5 });
      await diagnostics.assertClean(`${module.name} actions`);
    }

    await loginAs(page, 'guardian', testInfo);
    for (const module of ACTION_AUDIT_GUARDIAN_MODULES) {
      await navigateAndAssertLoaded(page, module, testInfo);
      await auditActionControls(page, module, testInfo, { actionLimit: 5 });
      await diagnostics.assertClean(`${module.name} actions`);
    }
  });

  test('Admin and Guardian route permissions are enforced', async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const diagnostics = attachDiagnostics(page, testInfo);

    await assertUnauthenticatedRedirect(page, '/analytics', /\/admin\/login|\/login/i);
    await assertUnauthenticatedRedirect(page, '/infants', /\/admin\/login|\/login/i);
    await assertUnauthenticatedRedirect(page, '/vaccination-management', /\/admin\/login|\/login/i);
    await assertUnauthenticatedRedirect(page, '/guardian/dashboard', /\/guardian\/login|\/login/i);
    await assertUnauthenticatedRedirect(page, '/guardian/children', /\/guardian\/login|\/login/i);

    await assertCrossRoleBlocked(page, 'guardian', '/analytics', /\/guardian\/dashboard|\/guardian\/login|\/login/i, testInfo);
    await assertCrossRoleBlocked(page, 'admin', '/guardian/dashboard', /\/analytics|\/admin\/login|\/login/i, testInfo);

    await diagnostics.assertClean('route permissions');
  });

  test('CRUD contract coverage is present for Admin and Guardian modules', async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const diagnostics = attachDiagnostics(page, testInfo);
    const openMutationSurfaces = envFlag('QA_ENABLE_MUTATION');
    const openDeleteConfirmations = envFlag('QA_ENABLE_DELETE_CONFIRMATION_TEST');
    let activeRole = null;

    for (const module of CRUD_CONTRACT_MODULES) {
      if (activeRole !== module.role) {
        await loginAs(page, module.role, testInfo);
        activeRole = module.role;
      }

      await navigateAndAssertLoaded(page, module, testInfo);
      await assertExpectedContent(page, module);
      await auditCrudContract(page, module, testInfo, {
        openMutationSurfaces,
        openDeleteConfirmations,
      });
      await diagnostics.assertClean(`${module.name} CRUD contract`);
    }

    if (!openMutationSurfaces) {
      testInfo.annotations.push({
        type: 'qa-crud',
        description:
          'Create/edit forms were not opened in this run. Set QA_ENABLE_MUTATION=true for disposable QA-database mutation-surface testing.',
      });
    }

    expect(openMutationSurfaces || !envFlag('QA_REQUIRE_MUTATION')).toBe(true);
  });
});
