/**
 * System Integration Test Suite
 * Tests critical backend-frontend integrations
 */

import apiClient from "./api";

export const runIntegrationTests = async () => {
  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  const addResult = (name, passed, error = null) => {
    results.tests.push({ name, passed, error });
    if (passed) results.passed++;
    else results.failed++;
  };

  console.log("🧪 Starting System Integration Tests...\n");

  // Test 1: API Connectivity
  try {
    const response = await fetch(
      `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/health`,
    );
    addResult("API Health Check", response.ok);
  } catch (error) {
    addResult("API Health Check", false, error.message);
  }

  // Test 2: Authentication - Session Verification
  try {
    const response = await apiClient.verifySession();
    addResult(
      "Session Verification",
      response.authenticated !== undefined,
      response.authenticated ? null : "Not authenticated",
    );
  } catch (error) {
    addResult("Session Verification", false, error.message);
  }

  // Test 3: Cookie Support
  try {
    const response = await fetch(
      `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/health`,
      {
        credentials: "include",
      },
    );
    addResult("Cookie Support (withCredentials)", response.ok);
  } catch (error) {
    addResult("Cookie Support (withCredentials)", false, error.message);
  }

  // Test 4: Dashboard Stats API
  try {
    const data = await apiClient.getDashboardStats();
    addResult(
      "Dashboard Stats API",
      data && typeof data === "object",
      data ? null : "Invalid response format",
    );
  } catch (error) {
    addResult("Dashboard Stats API", false, error.message);
  }

  // Test 5: Guardians API
  try {
    const data = await apiClient.getGuardians();
    addResult(
      "Guardians API",
      Array.isArray(data),
      Array.isArray(data) ? null : "Expected array response",
    );
  } catch (error) {
    addResult("Guardians API", false, error.message);
  }

  // Test 6: Infants API
  try {
    const data = await apiClient.getInfants();
    addResult(
      "Infants API",
      Array.isArray(data),
      Array.isArray(data) ? null : "Expected array response",
    );
  } catch (error) {
    addResult("Infants API", false, error.message);
  }

  // Test 7: Appointments API
  try {
    const data = await apiClient.getAppointments();
    addResult(
      "Appointments API",
      Array.isArray(data),
      Array.isArray(data) ? null : "Expected array response",
    );
  } catch (error) {
    addResult("Appointments API", false, error.message);
  }

  // Test 8: Vaccines API
  try {
    const data = await apiClient.getVaccines();
    addResult(
      "Vaccines API",
      Array.isArray(data),
      Array.isArray(data) ? null : "Expected array response",
    );
  } catch (error) {
    addResult("Vaccines API", false, error.message);
  }

  // Test 9: Inventory API
  try {
    const data = await apiClient.getInventoryItems();
    addResult(
      "Inventory API",
      Array.isArray(data),
      Array.isArray(data) ? null : "Expected array response",
    );
  } catch (error) {
    addResult("Inventory API", false, error.message);
  }

  // Test 10: Announcements API
  try {
    const data = await apiClient.getAnnouncements();
    addResult(
      "Announcements API",
      Array.isArray(data),
      Array.isArray(data) ? null : "Expected array response",
    );
  } catch (error) {
    addResult("Announcements API", false, error.message);
  }

  // Print Results
  console.log("\n📊 Test Results:");
  console.log("================");
  results.tests.forEach((test) => {
    const icon = test.passed ? "✅" : "❌";
    console.log(`${icon} ${test.name}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });
  console.log("\n================");
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(
    `📈 Success Rate: ${Math.round((results.passed / results.tests.length) * 100)}%`,
  );

  return results;
};

// Quick check for critical integrations
export const quickIntegrationCheck = async () => {
  const checks = {
    apiAvailable: false,
    authenticated: false,
    criticalEndpoints: [],
  };

  try {
    // Check API availability
    const healthResponse = await fetch(
      `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/health`,
    );
    checks.apiAvailable = healthResponse.ok;

    // Check authentication
    try {
      const sessionResponse = await apiClient.verifySession();
      checks.authenticated = sessionResponse.authenticated;
    } catch (e) {
      checks.authenticated = false;
    }

    return checks;
  } catch (error) {
    console.error("Integration check failed:", error);
    return checks;
  }
};

const integrationTestExports = {
  runIntegrationTests,
  quickIntegrationCheck,
};

export default integrationTestExports;
