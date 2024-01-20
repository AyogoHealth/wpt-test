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
import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mimeTypes from "mime-types";
import pathIsInside from "path-is-inside";

const handlers = [];

const error_codes = {
  400: "Bad Request",
  404: "Not Found",
  416: "Range Not Satisfiable",
  500: "Internal Server Error"
};
function error_response(response, code) {
  response.writeHead(code, {});
  response.write(error_codes[code] ?? "Error");
  response.end();
}

async function serveFile(path, stats, request, response) {
  const streamOpts = {};

  try {
    const stream = await createReadStream(path, streamOpts);

    const headers = {
      "Content-Length": stats.size
    };

    const contentType = mimeTypes.lookup(path);
    if (contentType) {
      headers["Content-Type"] = contentType;
    }

    response.writeHead(response.statusCode ?? 200, headers);
    stream.pipe(response);
  } catch (err) {
    return error_response(response, 500);
  }
}

async function requestHandler(request, response) {
  const cwd = process.cwd();

  let relativePath = null;
  try {
    relativePath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  } catch (err) {
    return error_response(response, 400);
  }

  let absolutePath = null;
  let stats = null;

  if (relativePath.startsWith("/resources/")) {
    const resourcePath = fileURLToPath(import.meta.resolve(`..${relativePath}`));

    try {
      stats = await lstat(resourcePath);
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
        return error_response(response, 404);
      }
    }

    if (stats && !stats.isDirectory()) {
      absolutePath = resourcePath;
    }
  }

  if (!absolutePath) {
    absolutePath = path.join(cwd, relativePath);
    stats = null;

    if (!pathIsInside(absolutePath, cwd)) {
      return error_response(response, 404);
    }

    try {
      stats = await lstat(absolutePath);
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
        return error_response(response, 404);
      }
    }
  }

  if (stats?.isSymbolicLink()) {
    absolutePath = await realpath(absolutePath);
    stats = null;

    try {
      stats = await lstat(absolutePath);
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
        return error_response(response, 404);
      }
    }
  }

  if (stats?.isDirectory()) {
    absolutePath = path.join(absolutePath, "index.html");
    stats = null;

    try {
      stats = await lstat(absolutePath);
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
        return error_response(response, 404);
      }
    }
  }

  if (!stats) {
    return error_response(response, 404);
  }

  return await serveFile(absolutePath, stats, request, response);
}

async function startServer(server) {
  await new Promise((resolve, reject) => {
    server.listen()
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
    const server = http.createServer(requestHandler);

    await startServer(server);

    console.log(`Running on http://localhost:${server.address().port}/`);

    return async function() {
      await stopServer(server);
    }
}

export async function withServer(fn) {
    const server = http.createServer(requestHandler);

    await startServer(server);

    try {
      await fn(`http://localhost:${server.address().port}`);
    } finally {
      await stopServer(server);
    }
}
