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
import { Readable } from "node:stream";

const Status = Object.freeze({
    PASS: 0,
    FAIL: 1,
    TIMEOUT: 2,
    NOTRUN: 3,
    PRECONDITION_FAILED: 4
});

const streamResult = Symbol("status");
const donePromise = Symbol("done_promise");

class TestsStream extends ReadableStream {
    get status() {
        return this[streamResult] ?? 0;
    }

    waitUntilDone() {
        return this[donePromise];
    }
}

class TestStreamSource {
    #isClosed = false;
    #buffer = [];
    #nextRead = null;

    start(controller) {
        while (this.#buffer.length > 0) {
            controller.enqueue(this.#buffer.shift());
        }
    }

    pull(controller) {
        this.#nextRead = null;
        if (this.#isClosed) {
            controller.close();
            return;
        }

        while (this.#buffer.length > 0) {
            controller.enqueue(this.#buffer.shift());
        }

        return new Promise((resolve) => {
          this.#nextRead = resolve;
        });
    }

    cancel() {
        this.#isClosed = true;
        this.#nextRead?.();
    }

    get closed() {
        return this.#isClosed;
    }

    close() {
        this.#isClosed = true;
        this.#nextRead?.();
    }

    dispatchEvent(type, data) {
        if (this.#isClosed) {
            throw new Error("Cannot publish to closed stream");
        }

        this.#buffer.push({ type, data });
        this.#nextRead?.();
    }
}

export class TestResultStream {
    #stream;
    #wrappedStream;
    #source;
    #suiteCount = 0;
    #testCount = 0;
    #hasFailures = false;

    constructor() {
        this.#source = new TestStreamSource();
        this.#stream = new TestsStream(this.#source);
        this.#wrappedStream = null;
    }

    get stream() {
        // The NodeJS docs lied and said TestsStream was a ReadableStream (web
        // stream), but it's actually a Readable (Node stream) 😒
        if (!this.#wrappedStream) {
            this.#wrappedStream = Readable.fromWeb(this.#stream, { objectMode: true });
            Object.defineProperty(this.#wrappedStream, "status", {
                get: () => this.#stream.status
            });
            Object.defineProperty(this.#wrappedStream, "waitUntilDone", {
                get: () => this.#stream.waitUntilDone.bind(this.#stream)
            });
        }

        return this.#wrappedStream;
    }

    close() {
        this.#stream[streamResult] = this.#hasFailures ? 1 : 0;

        this.#source.close();
    }

    setTestExecution(thenable) {
        this.#stream[donePromise] = thenable.finally(() => {
          if (!this.#source.closed) {
            this.close();
          }
        });
    }

    suiteStart(filename) {
        this.#source.dispatchEvent("test:start", {
            nesting: 0,
            name: filename,
            file: filename,
            column: 0,
            line: 0
        });

        this.#testCount = 0;
    }

    suiteFinish(filename, status, err = null) {
        this.#source.dispatchEvent("test:plan", {
            nesting: 0,
            file: filename,
            column: 0,
            line: 0,
            count: this.#testCount
        });

        if (status === Status.PASS || status === Status.PRECONDITION_FAILED) {
            this.#source.dispatchEvent("test:pass", {
                details: { type: "suite" },
                nesting: 0,
                file: filename,
                name: filename,
                column: 0,
                line: 0,
                skip: (status === Status.PRECONDITION_FAILED) ? "Optional Feature Unsupported" : undefined,
                testNumber: this.#suiteCount++
            });
        } else {
            this.#source.dispatchEvent("test:fail", {
                details: { type: "suite" },
                nesting: 0,
                file: filename,
                name: filename,
                column: 0,
                line: 0,
                skip: (status === Status.NOTRUN) ? "Not Run" : undefined,
                testNumber: this.#suiteCount++
            });
            this.#hasFailures = true;
        }
    }

    testStart(name, filename) {
        this.#source.dispatchEvent("test:start", {
            nesting: 1,
            name: name,
            file: filename,
            column: 0,
            line: 0
        });
    }

    testFinish(name, filename, status, err = null) {
        if (status === Status.PASS || status === Status.PRECONDITION_FAILED) {
            this.#source.dispatchEvent("test:pass", {
                details: {},
                nesting: 1,
                name: name,
                file: filename,
                column: 0,
                line: 0,
                skip: (status === Status.PRECONDITION_FAILED) ? "Optional Feature Unsupported" : undefined,
                testNumber: this.#testCount++
            });
        } else {
            this.#source.dispatchEvent("test:fail", {
                details: {},
                nesting: 1,
                name: name,
                file: filename,
                column: 0,
                line: 0,
                skip: (status === Status.NOTRUN) ? "Not Run" : undefined,
                testNumber: this.#testCount++
            });
            this.#hasFailures = true;
        }
    }
}
