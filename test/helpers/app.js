// Starts the real app in a throwaway copy of the repo, so tests never touch ./database or
// ./public/uploads in the working tree. node_modules and the static assets are symlinked.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const skip = new Set([".git", "node_modules", "public", "test"]);

exports.PASSWORD = "test-password-123";

function freePort() {
  return new Promise(function (resolve, reject) {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", function () {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function makeSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "notenote-test-"));
  for (const entry of fs.readdirSync(repoRoot)) {
    if (skip.has(entry) || entry.startsWith(".env")) continue;
    fs.cpSync(path.join(repoRoot, entry), path.join(dir, entry), {
      recursive: true,
      // database/ holds code (index.js, session-store.js) next to the local *.db files.
      filter: (src) => !/\.db(-wal|-shm)?$/.test(src),
    });
  }
  fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(dir, "node_modules"), "dir");
  // public/ is linked entry by entry so that uploads land in the sandbox's own public/uploads.
  fs.mkdirSync(path.join(dir, "public"));
  for (const entry of fs.readdirSync(path.join(repoRoot, "public"))) {
    if (entry === "uploads") continue;
    fs.symlinkSync(path.join(repoRoot, "public", entry), path.join(dir, "public", entry));
  }
  return dir;
}

async function waitForPort(port, child, output) {
  const deadline = Date.now() + 15000;
  for (;;) {
    if (child.exitCode !== null)
      throw Error("App exited with code " + child.exitCode + ":\n" + output());
    try {
      await fetch("http://127.0.0.1:" + port + "/robots.txt");
      return;
    } catch {
      if (Date.now() > deadline) throw Error("App did not start:\n" + output());
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

// Resolves once the server answers HTTP. `env` adds or overrides variables.
exports.start = async function (env = {}) {
  const dir = makeSandbox();
  const port = await freePort();
  // cwd must be the (copied) repo root: express.static("public") and the views directory are
  // resolved against the working directory.
  const child = spawn(process.execPath, ["app.js"], {
    cwd: dir,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      SESSION_SECRET: "s".repeat(48),
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  // app.js logs "Listening on port" before listen() has bound, so poll the port instead.
  await waitForPort(port, child, () => output);
  return {
    dir,
    baseUrl: "http://127.0.0.1:" + port,
    output: () => output,
    uploads() {
      const uploadDir = path.join(dir, "public", "uploads");
      return fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).sort() : [];
    },
    stop: async function () {
      if (child.exitCode === null) {
        await new Promise(function (resolve) {
          child.once("exit", resolve);
          child.kill();
        });
      }
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
};

// The flash message the alert partial puts on #ohsnap, or undefined.
exports.flash = function (text) {
  const decode = (s) =>
    s
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  const read = (kind) => {
    const m = text.match(new RegExp(`data-${kind}="([^"]*)"`));
    return m ? decode(m[1]) : undefined;
  };
  return { error: read("error"), success: read("success") };
};

// The post cards on a rendered page, in page order.
exports.cards = function (text) {
  return [
    ...text.matchAll(
      /<div class="card" data-postid="([^"]+)">([\s\S]*?)<div class="cardcom">\s*<textarea/g,
    ),
  ].map(([, id, html]) => ({
    id,
    html,
    name: html.match(/<a class="cardpreview" href="([^"]*)">[\s\S]*?<span>([^<]*)<\/span>/)?.[2],
    path: html.match(/<a class="cardpreview" href="([^"]*)">/)?.[1],
    karma: Number(html.match(/<span class="cardkarma">(-?\d+)<\/span>/)?.[1]),
    comments: [...html.matchAll(/<p class="comcontent">([^<]*)<\/p>/g)].map((m) => m[1]),
  }));
};

// A tiny browser stand-in: keeps cookies and reads the CSRF token from rendered pages.
exports.Client = class Client {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = {};
    this.csrfToken = null;
  }

  clone() {
    const copy = new Client(this.baseUrl);
    copy.cookies = { ...this.cookies };
    copy.csrfToken = this.csrfToken;
    return copy;
  }

  async request(method, url, { form, body, headers = {} } = {}) {
    const init = {
      method,
      redirect: "manual",
      headers: {
        cookie: Object.entries(this.cookies)
          .map(([k, v]) => k + "=" + v)
          .join("; "),
        ...headers,
      },
    };
    if (form) {
      init.body = new URLSearchParams(form).toString();
      init.headers["content-type"] = "application/x-www-form-urlencoded";
    } else if (body) {
      init.body = body;
    }
    const res = await fetch(this.baseUrl + url, init);
    for (const cookie of res.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const name = pair.slice(0, pair.indexOf("="));
      if (/expires=thu, 01 jan 1970/i.test(cookie)) delete this.cookies[name];
      else this.cookies[name] = pair.slice(pair.indexOf("=") + 1);
    }
    const text = await res.text();
    const token = text.match(/<meta name="csrf-token" content="([^"]+)">/);
    if (token) this.csrfToken = token[1];
    return {
      status: res.status,
      headers: res.headers,
      text,
      location: res.headers.get("location"),
    };
  }

  get(url) {
    return this.request("GET", url);
  }

  // Form request with the page's CSRF token in the body, as the site's own forms send it.
  send(method, url, fields = {}) {
    return this.request(method, url, { form: { _csrf: this.csrfToken, ...fields } });
  }

  post(url, fields) {
    return this.send("POST", url, fields);
  }

  // The page scripts' jQuery calls: the token in X-CSRF-Token, and a form body only when the
  // call passes data. Without `fields` the request has no body at all, as $.post(url) and
  // $.ajax({ type: "DELETE" }) send it.
  ajax(method, url, fields) {
    return this.request(method, url, {
      form: fields,
      headers: { "x-csrf-token": this.csrfToken },
    });
  }

  // Posts, then loads the redirect target and returns its flash messages.
  async postAndFollow(url, fields) {
    const res = await this.post(url, fields);
    if (res.status !== 302) throw Error(`POST ${url}: expected a redirect, got ${res.status}`);
    const page = await this.get(res.location);
    return { location: res.location, page, ...exports.flash(page.text) };
  }

  // Registers through the form; any field can be overridden. Leaves the client signed in.
  async signUp(username, fields = {}) {
    await this.get("/register");
    return this.post("/signup", {
      username,
      password: exports.PASSWORD,
      password2: exports.PASSWORD,
      ...fields,
    });
  }

  async signIn(username, password = exports.PASSWORD) {
    await this.get("/");
    return this.post("/signin", { username, password });
  }

  async isSignedIn() {
    return (await this.get("/posts/upload")).status === 200;
  }

  // Uploads through the form on /posts/upload. `file` is { name, type, content }.
  async upload(
    fields = {},
    file = { name: "notes.pdf", type: "application/pdf", content: "%PDF-1.4" },
  ) {
    await this.get("/posts/upload");
    const form = new FormData();
    const all = { _csrf: this.csrfToken, name: "Notes", text: "", tags: "", ...fields };
    for (const [key, value] of Object.entries(all)) {
      if (value !== undefined) form.append(key, value);
    }
    if (file) form.append("file", new Blob([file.content], { type: file.type }), file.name);
    return this.request("POST", "/posts", { body: form });
  }

  // Uploads and returns the new post's id (from the /posts/<id> redirect).
  async uploadPost(fields, file) {
    const res = await this.upload(fields, file);
    const id = res.location?.match(/^\/posts\/([0-9a-f-]{36})$/)?.[1];
    if (res.status !== 302 || !id) throw Error(`upload failed: ${res.status} ${res.location}`);
    return id;
  }
};
