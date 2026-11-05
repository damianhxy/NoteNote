// Uploading, viewing, voting on and deleting posts, plus the pages that list them.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { start, Client, flash, cards } = require("./helpers/app.js");

let app;
let alice;
let bob;
before(async function () {
  app = await start();
  alice = new Client(app.baseUrl);
  await alice.signUp("alice");
  bob = new Client(app.baseUrl);
  await bob.signUp("bob");
});
after(() => app.stop());

const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

test("the upload page has the multipart form", async function () {
  const res = await alice.get("/posts/upload");
  assert.equal(res.status, 200);
  assert.match(res.text, /<form method="POST" action="\/posts" enctype="multipart\/form-data">/);
  assert.match(res.text, /<input type="hidden" name="_csrf" value="[^"]+">/);
});

test("uploading a file creates a post and serves the file", async function () {
  const res = await alice.upload(
    { name: "Calculus notes", text: "Limits and derivatives", tags: "math, calculus" },
    { name: "Calc.PDF", type: "application/pdf", content: "%PDF-1.4 calculus" },
  );
  assert.equal(res.status, 302);
  const id = res.location.match(/^\/posts\/([0-9a-f-]{36})$/)?.[1];
  assert.ok(id, res.location);

  const page = await alice.get(res.location);
  assert.equal(page.status, 200);
  const [card] = cards(page.text);
  assert.equal(card.id, id);
  assert.equal(card.name, "Calculus notes");
  assert.equal(card.karma, 0);
  assert.match(card.html, /<p class="cardcaption">Limits and derivatives<\/p>/);
  assert.match(card.html, /<a href="\/posts\/search\?query=math">math<\/a>/);
  assert.match(card.html, /<a href="\/posts\/search\?query=calculus">calculus<\/a>/);
  assert.match(card.html, /<i class="fa fa-file-pdf-o"><\/i>/);
  // Stored under a random name with the extension lower-cased; the original name is not used.
  assert.match(card.path, /^\/uploads\/[0-9a-f-]{36}\.pdf$/);
  assert.deepEqual(app.uploads(), [card.path.slice("/uploads/".length)]);

  const file = await fetch(app.baseUrl + card.path);
  assert.equal(file.status, 200);
  assert.equal(await file.text(), "%PDF-1.4 calculus");
});

test("a post without tags is tagged 'untagged'", async function () {
  const id = await alice.uploadPost({ name: "Loose sheet" });
  const [card] = cards((await alice.get("/posts/" + id)).text);
  assert.match(card.html, /<a href="\/posts\/search\?query=untagged">untagged<\/a>/);
});

test("an upload of a type that is not allowed is refused and leaves no file", async function () {
  const before = app.uploads();
  for (const file of [
    { name: "run.exe", type: "application/octet-stream", content: "MZ" },
    { name: "notes.pdf", type: "text/html", content: "<script></script>" },
  ]) {
    const res = await alice.upload({ name: "Bad" }, file);
    assert.equal(res.status, 302, file.name);
    assert.equal(res.location, "/posts/upload", file.name);
    assert.match(flash((await alice.get("/posts/upload")).text).error, /^File type not allowed/);
  }
  assert.deepEqual(app.uploads(), before);
});

test("an upload without a file is refused", async function () {
  const res = await alice.upload({ name: "Nothing" }, null);
  assert.equal(res.location, "/posts/upload");
  assert.equal(flash((await alice.get("/posts/upload")).text).error, "No file uploaded");
});

test("an upload without the CSRF token is refused and leaves no file", async function () {
  const before = app.uploads();
  const res = await alice.upload({ _csrf: undefined, name: "No token" });
  assert.equal(res.status, 403);
  await settle();
  assert.deepEqual(app.uploads(), before);
});

test("a visitor cannot upload", async function () {
  const res = await new Client(app.baseUrl).upload({ name: "Anon" });
  assert.equal(res.status, 302);
  assert.equal(res.location, "/");
});

test("an unknown post id shows an empty page", async function () {
  const res = await alice.get("/posts/00000000-0000-0000-0000-000000000000");
  assert.equal(res.status, 200);
  assert.match(res.text, /There are no notes/);
});

test("only the author sees the delete control on a post", async function () {
  const id = await alice.uploadPost({ name: "Mine" });
  const control = /<i class="close"><i class="fa fa-close"><\/i><\/i>/;
  assert.match((await alice.get("/posts/" + id)).text, control);
  const other = await bob.get("/posts/" + id);
  assert.equal(cards(other.text)[0].id, id);
  assert.doesNotMatch(other.text, control);
});

// The page's script deletes with $.ajax({ type: "DELETE" }), which sends no body, and that 500s
// today (the todo in baseline.test.js). With the token in a form body the route itself works.
test("the author can delete a post, which removes its file", async function () {
  const id = await alice.uploadPost({ name: "To delete" });
  const [card] = cards((await alice.get("/posts/" + id)).text);
  const file = card.path.slice("/uploads/".length);
  assert.ok(app.uploads().includes(file));
  const res = await alice.send("DELETE", "/posts/" + id);
  assert.equal(res.status, 200);
  assert.match((await alice.get("/posts/" + id)).text, /There are no notes/);
  await settle();
  assert.ok(!app.uploads().includes(file));
});

test("another user cannot delete a post", async function () {
  const id = await alice.uploadPost({ name: "Keep me" });
  await bob.get("/posts/" + id);
  const res = await bob.send("DELETE", "/posts/" + id);
  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(res.text), { error: "Failed to delete post" });
  assert.equal(cards((await alice.get("/posts/" + id)).text)[0]?.id, id);
});

test("deleting needs the CSRF token", async function () {
  const id = await alice.uploadPost({ name: "Guarded" });
  const res = await alice.request("DELETE", "/posts/" + id, { form: { confirm: "1" } });
  assert.equal(res.status, 403);
  assert.equal(cards((await alice.get("/posts/" + id)).text)[0]?.id, id);
});

test("votes change the post's karma and its author's karma", async function () {
  const carol = new Client(app.baseUrl);
  await carol.signUp("carol");
  const id = await carol.uploadPost({ name: "Vote on me" });
  const karma = async () => cards((await carol.get("/posts/" + id)).text)[0].karma;
  const authorKarma = async () =>
    Number(
      (await carol.get("/users/carol")).text.match(/<span id="karmacount">(-?\d+)<\/span>/)[1],
    );

  await alice.get("/posts/" + id);
  await bob.get("/posts/" + id);
  assert.equal((await alice.ajax("POST", "/posts/vote/" + id, { val: 1 })).status, 200);
  assert.equal((await bob.ajax("POST", "/posts/vote/" + id, { val: 1 })).status, 200);
  assert.equal(await karma(), 2);
  assert.equal(await authorKarma(), 2);

  // Switching from up to down moves by two; voting 0 withdraws the vote.
  await alice.ajax("POST", "/posts/vote/" + id, { val: -1 });
  assert.equal(await karma(), 0);
  await bob.ajax("POST", "/posts/vote/" + id, { val: 0 });
  assert.equal(await karma(), -1);
  assert.equal(await authorKarma(), -1);

  // The vote buttons show the viewer's current vote.
  const page = (await alice.get("/posts/" + id)).text;
  assert.match(page, /class="carddown" data-value="-1" data-toggle="true"/);
  assert.match(page, /class="cardup" data-value="1" data-toggle="false"/);
});

test("voting needs the CSRF token and a signed-in user", async function () {
  const id = await alice.uploadPost({ name: "Guarded vote" });
  assert.equal((await bob.request("POST", "/posts/vote/" + id, { form: { val: 1 } })).status, 403);
  const visitor = new Client(app.baseUrl);
  await visitor.get("/");
  assert.equal((await visitor.ajax("POST", "/posts/vote/" + id, { val: 1 })).location, "/");
  assert.equal(cards((await alice.get("/posts/" + id)).text)[0].karma, 0);
});

test("voting on an unknown post fails", async function () {
  const res = await alice.ajax("POST", "/posts/vote/00000000-0000-0000-0000-000000000000", {
    val: 1,
  });
  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(res.text), { error: "Vote failed" });
});

test("Highest Rated lists every post by karma", async function () {
  const dave = new Client(app.baseUrl);
  await dave.signUp("dave");
  const low = await dave.uploadPost({ name: "Low" });
  const high = await dave.uploadPost({ name: "High" });
  for (const voter of [alice, bob]) {
    await voter.get("/top");
    await voter.ajax("POST", "/posts/vote/" + high, { val: 1 });
  }
  await alice.ajax("POST", "/posts/vote/" + low, { val: -1 });
  const ids = cards((await bob.get("/top")).text).map((c) => c.id);
  assert.equal(ids[0], high);
  assert.equal(ids.at(-1), low);
  // Visitors can see it too.
  assert.equal((await new Client(app.baseUrl).get("/top")).status, 200);
});

test("the home page streams posts from followed users, newest first", async function () {
  const erin = new Client(app.baseUrl);
  await erin.signUp("erin");
  assert.match((await erin.get("/")).text, /There are no notes/);
  const first = await bob.uploadPost({ name: "Bob first" });
  await new Promise((resolve) => setTimeout(resolve, 1100)); // post dates have 1 s resolution
  const second = await bob.uploadPost({ name: "Bob second" });
  await erin.get("/users/bob");
  assert.equal((await erin.post("/users/follow/bob")).status, 200);
  const ids = cards((await erin.get("/")).text).map((c) => c.id);
  assert.deepEqual(ids, [second, first]);
});

test.todo("3.9 input bounds: a vote other than -1, 0 or 1 is refused", async function () {
  const id = await alice.uploadPost({ name: "Bounded vote" });
  await bob.get("/posts/" + id);
  const res = await bob.ajax("POST", "/posts/vote/" + id, { val: 100 });
  assert.notEqual(res.status, 200);
  assert.equal(cards((await alice.get("/posts/" + id)).text)[0].karma, 0);
});
