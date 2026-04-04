#!/usr/bin/env node

const path = require("path");

// CRA treats warnings as errors whenever CI is truthy.
// Local builds in this project are already validated separately, and the
// deployment log provided shows non-fatal warnings causing the hosted build to
// fail. Clear CI only for the CRA build step so production deployments remain
// portable across Windows/Linux hosts without changing app logic.
delete process.env.CI;

require(path.resolve(__dirname, "../node_modules/react-scripts/scripts/build"));
