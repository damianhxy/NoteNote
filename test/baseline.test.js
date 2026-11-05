// Cross-cutting checks: secrets, CSRF, proxy settings, rate limiting, error pages and page
// security. test.todo entries are known gaps, named after the baseline item they miss. Each body
// checks the behaviour the fix should produce, so fixing one means dropping ".todo".
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { start, Client, flash, cards, PASSWORD } = require("./helpers/app.js");

let app;
let alice;
before(async function () {
  app = await start();
  alice = new Client(app.baseUrl);
  await alice.signUp("alice");
});
after(() => app.stop());

// Runs the sandbox's app.js with only SESSION_SECRET set (the sandbox has no .env). A process
// still running at the timeout started; status is then null.
function bootWithSecret(secret) {
  return spawnSync(process.execPath, ["app.js"], {
    cwd: app.dir,
    env: { PATH: process.env.PATH, PORT: "0", SESSION_SECRET: secret },
    encoding: "utf8",
    timeout: 5000,
  });
}

test("the app refuses to start with a missing, short or .env.example secret", function () {
  const example = fs.readFileSync(path.resolve(__dirname, "..", ".env.example"), "utf8");
  const placeholder = example.match(/^SESSION_SECRET=(.*)$/m)[1];
  for (const secret of ["", "too-short", placeholder]) {
    const result = bootWithSecret(secret);
    assert.equal(result.status, 1, JSON.stringify(secret));
    assert.match(result.stderr, /SESSION_SECRET/);
  }
});

test("a form POST without a CSRF token is refused with a short message", async function () {
  const client = new Client(app.baseUrl);
  await client.get("/");
  const res = await client.request("POST", "/signin", {
    form: { username: "alice", password: PASSWORD },
  });
  assert.equal(res.status, 403);
  assert.deepEqual(JSON.parse(res.text), { error: "CSRF token invalid" });
  assert.equal(await client.isSignedIn(), false);
});

test("a form POST with a wrong CSRF token is refused", async function () {
  const client = new Client(app.baseUrl);
  await client.get("/");
  const res = await client.request("POST", "/signin", {
    form: { _csrf: "wrong", username: "alice", password: PASSWORD },
  });
  assert.equal(res.status, 403);
});

test("a token only in ?_csrf= is refused", async function () {
  const client = new Client(app.baseUrl);
  await client.get("/");
  const res = await client.request(
    "POST",
    "/signin?_csrf=" + encodeURIComponent(client.csrfToken),
    {
      form: { username: "alice", password: PASSWORD },
    },
  );
  assert.equal(res.status, 403);
});

test("a token in the X-CSRF-Token header with a form body is accepted", async function () {
  const client = new Client(app.baseUrl);
  await client.get("/");
  const res = await client.ajax("POST", "/signin", { username: "alice", password: PASSWORD });
  assert.equal(res.status, 302);
  assert.equal(await client.isSignedIn(), true);
});

test.todo(
  "3.5 forms, bodyless and multipart CSRF correct: header token and no body (follow, delete)",
  async function () {
    const bob = new Client(app.baseUrl);
    await bob.signUp("bob");
    const id = await alice.uploadPost({ name: "Bodyless" });
    await alice.ajax("POST", "/posts/comment/" + id, { content: "hi" });
    await alice.get("/users/bob");
    // As profile.js and main.js send them: $.post(url) and $.ajax({ type: "DELETE" }).
    assert.equal((await alice.ajax("POST", "/users/follow/bob")).status, 200);
    assert.equal((await alice.ajax("DELETE", `/posts/comment/${id}/0`)).status, 200);
    assert.equal((await alice.ajax("DELETE", "/posts/" + id)).status, 200);
    assert.equal(cards((await alice.get("/posts/" + id)).text).length, 0);
  },
);

test.todo(
  "3.7 app-level 4-arg error handler: a malformed JSON body gets a short 400, no stack trace",
  async function () {
    const res = await new Client(app.baseUrl).request("POST", "/signin", {
      body: "{",
      headers: { "content-type": "application/json" },
    });
    assert.equal(res.status, 400);
    assert.doesNotMatch(res.text, /at \w+ \(|node_modules/);
  },
);

test.todo(
  "3.6 POST sign-out + destroy: GET is gone, POST needs the token and kills the session",
  async function () {
    const client = new Client(app.baseUrl);
    await client.signIn("alice");
    assert.equal((await client.get("/signout")).status, 404);
    assert.equal(await client.isSignedIn(), true);
    const noToken = await client.request("POST", "/signout", { form: {} });
    assert.equal(noToken.status, 403);
    const oldCookie = client.clone();
    const res = await client.post("/signout");
    assert.equal(res.status, 302);
    assert.equal(client.cookies["connect.sid"], undefined, "cookie should be cleared");
    assert.equal(await oldCookie.isSignedIn(), false, "old session cookie must not work");
  },
);

test.todo(
  "3.9 generic sign-in failure message: unknown user and wrong password look the same",
  async function () {
    const messages = [];
    for (const [username, password] of [
      ["nobody", PASSWORD],
      ["alice", "wrong-password"],
    ]) {
      const client = new Client(app.baseUrl);
      await client.signIn(username, password);
      messages.push(flash((await client.get("/")).text).error);
    }
    assert.equal(messages[0], messages[1]);
  },
);

test.todo("3.9 usernames: only letters, digits and _ are accepted", async function () {
  const client = new Client(app.baseUrl);
  const res = await client.signUp("bad/name");
  assert.equal(res.location, "/register");
  assert.equal(await client.isSignedIn(), false);
});

test.todo(
  "3.8 same-origin back redirect: sign-in ignores a foreign Referer and pages send one",
  async function () {
    const client = new Client(app.baseUrl);
    const page = await client.get("/");
    assert.equal(page.headers.get("referrer-policy"), "same-origin");
    const res = await client.request("POST", "/signin", {
      form: { _csrf: client.csrfToken, username: "alice", password: PASSWORD },
      headers: { referer: "https://evil.example/phish" },
    });
    assert.equal(res.location, "/");
  },
);

test("the sign-in limit stops the 21st attempt from one address", async function () {
  const limited = await start();
  try {
    let res;
    for (let i = 0; i < 21; i++) res = await new Client(limited.baseUrl).signIn("nobody", "x");
    assert.equal(res.status, 429);
  } finally {
    await limited.stop();
  }
});

test("page loads of / and /register do not count toward the sign-in limit", async function () {
  const limited = await start();
  try {
    const client = new Client(limited.baseUrl);
    for (let i = 0; i < 25; i++) {
      assert.equal((await client.get(i % 2 ? "/" : "/register")).status, 200);
    }
    assert.equal((await client.signIn("nobody", "x")).status, 302);
  } finally {
    await limited.stop();
  }
});

test.todo(
  "3.4 auth limiter POST-only: GET requests to /signin do not count toward the limit",
  async function () {
    const limited = await start();
    try {
      const client = new Client(limited.baseUrl);
      for (let i = 0; i < 25; i++) await client.get("/signin");
      assert.equal((await client.signIn("nobody", "x")).status, 302);
    } finally {
      await limited.stop();
    }
  },
);

test("TRUST_PROXY values true, false, 1 and loopback all boot", async function () {
  for (const value of ["true", "false", "1", "loopback"]) {
    const instance = await start({ TRUST_PROXY: value });
    try {
      assert.equal((await fetch(instance.baseUrl + "/")).status, 200, value);
    } finally {
      await instance.stop();
    }
  }
});

test.todo(
  "3.4 TRUST_PROXY for the Secure cookie: production issues a Secure cookie behind a proxy",
  async function () {
    const prod = await start({ NODE_ENV: "production", TRUST_PROXY: "1" });
    try {
      const client = new Client(prod.baseUrl);
      const page = await client.request("GET", "/", {
        headers: { "x-forwarded-proto": "https", "x-forwarded-for": "203.0.113.9" },
      });
      // The landing page sets no session; a CSRF token is what first stores one.
      assert.ok(client.csrfToken);
      const cookie = page.headers.getSetCookie().find((c) => c.startsWith("connect.sid="));
      assert.ok(cookie, "no session cookie issued");
      assert.match(cookie, /;\s*Secure/i);
      assert.match(cookie, /;\s*HttpOnly/i);
    } finally {
      await prod.stop();
    }
  },
);

test.todo(
  "3.4 TRUST_PROXY for the Secure cookie: 21 failed sign-ins from one client do not lock out another",
  async function () {
    const proxied = await start({ TRUST_PROXY: "1" });
    try {
      const attempt = async (ip) => {
        const client = new Client(proxied.baseUrl);
        await client.get("/");
        return client.request("POST", "/signin", {
          form: { _csrf: client.csrfToken, username: "nobody", password: "x" },
          headers: { "x-forwarded-for": ip },
        });
      };
      let res;
      for (let i = 0; i < 21; i++) res = await attempt("203.0.113.7");
      assert.equal(res.status, 429, "the limiter should stop the 21st attempt");
      res = await attempt("203.0.113.8");
      assert.equal(res.status, 302);
    } finally {
      await proxied.stop();
    }
  },
);

test.todo(
  "3.10 CSP: pages carry no inline scripts or handlers that helmet's CSP blocks",
  async function () {
    await alice.uploadPost({ name: "Script check" });
    const pages = [
      await new Client(app.baseUrl).get("/"),
      await new Client(app.baseUrl).get("/register"),
      await alice.get("/"),
      await alice.get("/top"),
      await alice.get("/users/alice"),
      await alice.get("/posts/upload"),
    ];
    for (const page of pages) {
      assert.match(page.headers.get("content-security-policy"), /script-src 'self'/);
      assert.doesNotMatch(page.text, /<script(?![^>]*\bsrc=)[^>]*>/);
      assert.doesNotMatch(page.text, /\son[a-z]+="/);
    }
  },
);

test.todo("avatars: pages load no images from the defunct api.adorable.io", async function () {
  const id = await alice.uploadPost({ name: "Avatar check" });
  await alice.ajax("POST", "/posts/comment/" + id, { content: "hi" });
  for (const url of ["/posts/" + id, "/users/alice"]) {
    assert.doesNotMatch((await alice.get(url)).text, /api\.adorable\.io/);
  }
});

test.todo(
  "startup: a port that is already taken exits without logging 'Listening'",
  async function () {
    const blocker = net.createServer();
    await new Promise((resolve) => blocker.listen(0, resolve));
    try {
      const result = spawnSync(process.execPath, ["app.js"], {
        cwd: app.dir,
        env: {
          PATH: process.env.PATH,
          PORT: String(blocker.address().port),
          SESSION_SECRET: "s".repeat(48),
        },
        encoding: "utf8",
        timeout: 5000,
      });
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(result.stdout + result.stderr, /Listening on port/);
    } finally {
      blocker.close();
    }
  },
);
