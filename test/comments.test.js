// Comments on posts, as the page script sends them: $.post with { content } and the token in
// the X-CSRF-Token header.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { start, Client, cards } = require("./helpers/app.js");

let app;
let alice;
let bob;
let postId;
before(async function () {
  app = await start();
  alice = new Client(app.baseUrl);
  await alice.signUp("alice");
  bob = new Client(app.baseUrl);
  await bob.signUp("bob");
  postId = await alice.uploadPost({ name: "Discuss me" });
  await bob.get("/posts/" + postId);
});
after(() => app.stop());

const comments = async (client) => cards((await client.get("/posts/" + postId)).text)[0].comments;

test("a comment is added, trimmed and shown under the post", async function () {
  const res = await bob.ajax("POST", "/posts/comment/" + postId, { content: "  Great notes  " });
  assert.equal(res.status, 200);
  assert.deepEqual(await comments(alice), ["Great notes"]);
  const page = (await alice.get("/posts/" + postId)).text;
  assert.match(page, /<a href="\/users\/bob" class="comname">bob<\/a>/);
});

test("an empty or overlong comment is refused", async function () {
  const before = await comments(bob);
  for (const content of ["", "   ", "x".repeat(1001)]) {
    const res = await bob.ajax("POST", "/posts/comment/" + postId, { content });
    assert.equal(res.status, 400, JSON.stringify(content.slice(0, 5)));
    assert.deepEqual(JSON.parse(res.text), { error: "Invalid comment" });
  }
  assert.deepEqual(await comments(bob), before);
});

test("commenting needs the CSRF token and a signed-in user", async function () {
  const before = await comments(bob);
  const noToken = await bob.request("POST", "/posts/comment/" + postId, {
    form: { content: "hi" },
  });
  assert.equal(noToken.status, 403);
  const visitor = new Client(app.baseUrl);
  await visitor.get("/");
  const anon = await visitor.ajax("POST", "/posts/comment/" + postId, { content: "hi" });
  assert.equal(anon.location, "/");
  assert.deepEqual(await comments(bob), before);
});

test("commenting on an unknown post fails", async function () {
  const res = await bob.ajax("POST", "/posts/comment/00000000-0000-0000-0000-000000000000", {
    content: "hello",
  });
  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(res.text), { error: "Failed to add comment" });
});

test("only the comment's author sees its delete control", async function () {
  await alice.ajax("POST", "/posts/comment/" + postId, { content: "Thanks" });
  const control = (index) => `<i class="close com" data-index="${index}">`;
  const asBob = (await bob.get("/posts/" + postId)).text;
  const asAlice = (await alice.get("/posts/" + postId)).text;
  assert.ok(asBob.includes(control(0)));
  assert.ok(!asBob.includes(control(1)));
  assert.ok(asAlice.includes(control(1)));
  assert.ok(!asAlice.includes(control(0)));
});

// The page script deletes with $.ajax({ type: "DELETE" }) and no body, which 500s today (the
// todo in baseline.test.js). With the token in a form body the route works.
test("the author can delete their comment", async function () {
  const before = await comments(bob);
  await bob.ajax("POST", "/posts/comment/" + postId, { content: "Typo here" });
  const index = (await comments(bob)).indexOf("Typo here");
  const res = await bob.send("DELETE", `/posts/comment/${postId}/${index}`);
  assert.equal(res.status, 200);
  assert.deepEqual(await comments(bob), before);
});

test.todo("3.9 escape on output: a comment with & and < is shown as typed", async function () {
  await bob.ajax("POST", "/posts/comment/" + postId, { content: "Tom & Jerry <3" });
  const page = (await alice.get("/posts/" + postId)).text;
  assert.ok(page.includes('<p class="comcontent">Tom &amp; Jerry &lt;3</p>'));
});

test.todo("3.9 authorisation: only a comment's author can delete it", async function () {
  await bob.ajax("POST", "/posts/comment/" + postId, { content: "Comment by bob" });
  const index = (await comments(alice)).indexOf("Comment by bob");
  const res = await alice.send("DELETE", `/posts/comment/${postId}/${index}`);
  assert.notEqual(res.status, 200);
  assert.ok((await comments(alice)).includes("Comment by bob"));
});
