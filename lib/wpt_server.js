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
import http from "node:http";
import serve_handler from "serve-handler";
import pathIsInside from "path-is-inside";

const handlers = [];

function createServer() {
  return http.createServer((request, response) => {
    const cwd = process.cwd();

    let relativePath = null;
    try {
      relativePath = decodeURIComponent(url.parse(request.url).pathname);
    } catch (err) {
      response.writeHead(400, {});
      response.write("Bad request");
      response.end();
      return;
    }

    let absolutePath = path.join(cwd, relativePath);
    if (!isPathInside(absolutePath, cwd)) {
      response.writeHead(400, {});
      response.write("Bad request");
      response.end();
      return;
    }

    // Cheat for now and use serve_handler as our static server
    return serve_handler(request, response);
  });
}

async function startServer(server) {
  await new Promise((resolve, reject) => {
    server.listen(3000)
      .once("listening", resolve)
      .once("error", reject);
  });
}

async function stopServer(server) {
    await new Promise((resolve, reject) => {
      server.close();

      server
        .once("close", resolve)
        .once("error", reject);
    });
}


export async function runServer() {
    const server = createServer();

    await startServer(server);

    return async function() {
      await stopServer(server);
    }
}

export async function withServer(fn) {
    const server = createServer();

    await startServer(server);

    try {
      await fn();
    } finally {
      await stopServer(server);
    }
}
