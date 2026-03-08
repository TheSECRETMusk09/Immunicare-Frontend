/**
 * Mobile UI Test Runner Script
 * Simplifies execution of Guardian Dashboard mobile tests
 *
 * Usage: node e2e/run-tests.js [options]
 */

const { execSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const options = {
  headed: args.includes('--headed') || args.includes('-h'),
  debug: args.includes('--debug') || args.includes('-d'),
  tag: args.find(arg => arg.startsWith('--tag='))?.split('=')[1],
  project: args.find(arg => arg.startsWith('--project='))?.split('=')[1],
  reporter: args.find(arg => arg.startsWith('--reporter='))?.split('=')[1] || 'html',
  help: args.includes('--help') || args.includes('-h') && args.length === 1,
};

function showHelp() {
  console.log(`
Guardian Dashboard Mobile UI Test Runner

Usage: node e2e/run-tests.js [options]

Options:
  --headed, -h          Run tests in headed mode (see browser)
  --debug, -d           Run in debug mode
  --tag=<tag>           Run tests with specific tag (@touch, @a11y, @e2e, etc.)
  --project=<name>      Run on specific device project
  --reporter=<type>     Reporter type: html, json, line, dot (default: html)
  --help                Show this help message

Examples:
  node e2e/run-tests.js                              # Run all tests
  node e2e/run-tests.js --headed                     # Run with visible browser
  node e2e/run-tests.js --tag=@touch                 # Run touch target tests only
  node e2e/run-tests.js --tag=@a11y --headed         # Run accessibility tests visibly
  node e2e/run-tests.js --project="Mobile - iPhone"  # Run on iPhone only
  node e2e/run-tests.js --reporter=json              # Generate JSON report

Available Tags:
  @responsive     - Layout and breakpoint tests
  @touch          - Touch target and gesture tests
  @modal          - Modal behavior tests
  @scroll         - Scroll containment tests
  @forms          - Form input tests
  @keyboard       - Virtual keyboard tests
  @a11y           - Accessibility tests
  @e2e            - End-to-end user flows
  @critical       - Critical path tests
  @mobile         - Mobile-specific tests

Available Projects:
  "Mobile - iPhone SE (320x568)"
  "Mobile - iPhone 12/13 Mini (375x812)"
  "Mobile - iPhone 12/13/14 (390x844)"
  "Mobile - Samsung Galaxy S23 (360x780)"
  "Mobile - Google Pixel 7 (412x915)"
  "Tablet - iPad Mini (768x1024)"
  "Tablet - iPad Air (820x1180)"
`);
}

function buildCommand() {
  let cmd = 'npx playwright test';

  if (options.headed) {
    cmd += ' --headed';
  }

  if (options.debug) {
    cmd += ' --debug';
  }

  if (options.tag) {
    cmd += ` --grep ${options.tag}`;
  }

  if (options.project) {
    cmd += ` --project="${options.project}"`;
  }

  if (options.reporter) {
    cmd += ` --reporter=${options.reporter}`;
  }

  // Always generate HTML report
  if (options.reporter !== 'html') {
    cmd += ',html';
  }

  return cmd;
}

function runTests() {
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Guardian Dashboard Mobile UI Test Runner');
  console.log('═══════════════════════════════════════════════════════════\n');

  const cmd = buildCommand();

  console.log('Configuration:');
  console.log(`  Command: ${cmd}`);
  console.log(`  Headed: ${options.headed ? 'Yes' : 'No'}`);
  console.log(`  Debug: ${options.debug ? 'Yes' : 'No'}`);
  console.log(`  Tag: ${options.tag || 'All'}`);
  console.log(`  Project: ${options.project || 'All'}`);
  console.log(`  Reporter: ${options.reporter}\n`);

  console.log('Running tests...\n');

  try {
    execSync(cmd, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });

    console.log('\n✅ Tests completed successfully!');
    console.log('\nView HTML report:');
    console.log('  npx playwright show-report e2e/playwright-report');

    process.exit(0);
  } catch (error) {
    console.log('\n❌ Tests failed!');
    console.log('\nView HTML report:');
    console.log('  npx playwright show-report e2e/playwright-report');

    process.exit(1);
  }
}

runTests();
