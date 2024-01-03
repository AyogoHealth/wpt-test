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
import { parseArgs } from "node:util";
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
  }
};

const opts = {};
const args = parseArgs({ strict: true, allowPositionals: true, options: flagOptions });

if ("help" in args.values) {
  console.log("Usage: wpt-test [OPTIONS] TEST_DIRECTORY");
  console.log("TODO: Write help output");
  process.exit(0);
}

if ("verbose" in args.values) {
  opts.verbose = true;
}

if ("browser" in args.values) {
  opts.browser = args.values.browser;
}

const testReporter = reporters.spec;
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

  setImmediate(() => {
    console.log("");
    process.exit(test_stream.status);
  });
}
