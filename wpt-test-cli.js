#!/usr/bin/env node
/*! Copyright (c) 2023 Ayogo Health Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import process from 'node:process';
import reporters from "node:test/reporters";
import util from "node:util";
import { runServer } from "./lib/wpt_server.js";
import run from "./lib/runner.js";

const flagOptions = {
  help: {
    short: "h",
    type: "boolean"
  },
  serve: {
    short: "s",
    type: "boolean"
  },
  server: {
    type: "boolean"
  },
  verbose: {
    short: "v",
    type: "boolean"
  },
  browser: {
    type: "string"
  },
  reporter: {
    type: "string"
  },
  driverHostname: {
    type: "string"
  },
  driverPort: {
    type: "string"
  }
};

const opts = {};
const args = util.parseArgs({ strict: true, allowPositionals: true, options: flagOptions });

if ("help" in args.values) {
  usage();
  process.exit(0);
}

if ("verbose" in args.values) {
  opts.verbose = true;
}

if ("browser" in args.values) {
  opts.browser = args.values.browser;
}

if ("driverHostname" in args.values && "driverPort" in args.values) {
  opts.driverHostname = args.values.driverHostname;
  opts.driverPort = parseInt(args.values.driverPort, 10);
}

let testReporter = reporters.spec;
if ("reporter" in args.values) {
  if (args.values.reporter in reporters) {
    testReporter = reporters[args.values.reporter];
  }
}

if ("serve" in args.values || "server" in args.values) {
  const shutdown = await runServer();

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
  process.on("SIGQUIT", shutdown)
} else {
  const testdir = args.positionals[0] || "test";

  const test_stream = run(testdir, opts);
  test_stream.compose(testReporter).pipe(process.stdout);

  await test_stream.waitUntilDone();

  if (process.platform == "win32") {
    // Workaround for https://github.com/nodejs/node/issues/56645
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  setImmediate(() => {
    console.log("");
    process.exit(test_stream.status);
  });
}

// Helper functions below here ----------------------------------------------v

function bold(text) {
  if (util.hasOwnProperty("styleText")) {
    return util.styleText("bold", text);
  } else if (process.stdout?.hasColors?.()) {
    return `\u001b[1m${text}\u001b[22m`;
  } else {
    return text;
  }
}

function usage() {
  console.log("NodeJS test runner for web-platform-test testharness tests.");
  console.log("");
  console.log(bold("USAGE"));
  console.log("  npx wpt-test [FLAGS] TEST_DIR");
  console.log("");
  console.log("wpt-test will use web-driver to run all of the tests found in TEST_DIR in a");
  console.log("browser and report their results. Tests must be HTML file containing");
  console.log("TestHarness.js test cases.");
  console.log("By default, tests will run against a temporary local server in Chrome.");
  console.log("");
  console.log(bold("FLAGS"));
  console.log("  -h, --help                 Show usage");
  console.log("  -v, --verbose              Print additional debug logging");
  console.log("  -s, --serve                Run test server for manual debugging");
  console.log("      --browser=BROWSER      Use the specified browser for testing");
  console.log("      --reporter=TYPE        Print results using the specified reporter");
  console.log("")
  console.log("      --driverHostname=HOST  Specify the hostname of a WebDriver server (advanced)");
  console.log("      --driverPort=PORT      Specify the port number of a WebDriver server (advanced)");
}
