/**
 * Jest Configuration for Frontend
 * This file configures Jest to work with React and ES modules
 */

module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.js"],
  moduleNameMapper: {
    "^react-router-dom$": require.resolve("react-router-dom"),
    "^react-router-dom/(.*)$": require.resolve(`react-router-dom/$1`),
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(jpg|jpeg|png|gif|svg|webp|avif)$": "<rootDir>/__mocks__/fileMock.js",
  },
  transformIgnorePatterns: ["node_modules/(?!(react-router-dom|@tanstack)/)"],
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}",
  ],
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/index.js",
    "!src/reportWebVitals.js",
  ],
  moduleFileExtensions: ["js", "jsx", "ts", "tsx", "json"],
  resetMocks: true,
  restoreMocks: true,
  clearMocks: true,
};
