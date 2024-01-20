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

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import reporters from "node:test/reporters";
import { TestResultStream } from "./test_result_stream.js";
import { withWebDriver } from "./web_driver.js";
import { withServer } from "./wpt_server.js";

const getTestResultsAsync = `
    var cb = arguments[0];
    if (document.readyState == "complete") {
        window.__testharness__done__.then(cb);
    } else {
        window.addEventListener("load", () => window.__testharness__done__.then(cb));
    }
`;

async function* findTests(testdir) {
  const fileEntries = await fs.readdir(testdir, { recursive: true, withFileTypes: true });

  for (const fe of fileEntries) {
    if (!fe.isFile() || !fe.name.match(/\.html$/)) {
      continue;
    }

    yield path.join(fe.parentPath ?? fe.path, fe.name);
  }
}

async function runTests(reporter, testdir, opts) {
    await withServer(async function(hostname) {
        await withWebDriver(opts, async function(driver) {
            for await (const testcase of findTests(testdir)) {
                reporter.suiteStart(testcase);

                try {
                    const testurl = new URL(testcase, hostname);
                    await driver.navigateTo(testurl.toString());
                    const results = await driver.executeAsyncScript(getTestResultsAsync, []);

                    for (const test of results.tests) {
                        reporter.testStart(test.name, testcase);
                        reporter.testFinish(test.name, testcase, test.status);
                    }
                    reporter.suiteFinish(testcase, results.status);
                } catch (e) {
                    console.error(e);
                    reporter.suiteFinish(testcase, 1, e);
                }
            }
        });
    });
}

export default function run(testdir, opts) {
    const reporter = new TestResultStream();

    reporter.setTestExecution(runTests(reporter, testdir, opts));

    return reporter.stream;
}
