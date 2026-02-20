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
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from 'node:process';
import WebDriver from "webdriver";

export const ELEMENT_ID = "element-6066-11e4-a52e-4f735466cecf";

export async function withWebDriver(opts, fn) {
    const logLevel = !!opts.verbose ? "info" : "error";
    let logDir = opts.logDir;
    if (!logDir) {
        logDir = await mkdtemp(join(tmpdir(), "wpt-tests-"));
    }

    // Despite setting logLevel as part of the webDriver session options, this
    // doesn't actually apply all the way down the WebDriverIO module stack,
    // and since we're only using the WebDriver module we can't configure the
    // log level for the rest of their stack except by specifying an
    // environment variable override
    process.env.WDIO_LOG_LEVEL = logLevel;

    const sessionOptions = {
      capabilities: {
        "goog:chromeOptions": {
            args: ["--headless=new"]
        },
        "moz:firefoxOptions": {
            args: ["-headless"]
        },
        "ms:edgeOptions": {
            args: ["--headless"]
        }
      },
      logLevel: logLevel,
      outputDir: logDir
    };

    if (opts.driverHostname && opts.driverPort) {
      sessionOptions.hostname = opts.driverHostname;
      sessionOptions.port = opts.driverPort;

      // Disable WebDriver BiDi when connecting directly to a driver (for now, at least)
      sessionOptions.capabilities["wdio:enforceWebDriverClassic"] = true;
    } else {
      sessionOptions.capabilities.browserName = "chrome";
    }

    if (opts.browser) {
      sessionOptions.capabilities.browserName = opts.browser;
    }

    const driver = await WebDriver.newSession(sessionOptions);
    try {
        await fn(driver);
    } finally {
        await driver.deleteSession();
    }
}
