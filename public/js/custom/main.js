$(function () {
  console.info("[info] main.js is now running");

  // Delete Post
  $(".close:not(.com)").click(function () {
    if (confirm("Are you sure?")) {
      const $card = $(this).closest(".card");
      const dtarget = $card.data("postid");
      $.ajax({
        url: "/posts/" + dtarget,
        type: "DELETE",
        success: function () {
          $card.remove();
          if (!$("[data-postID]").length) location.reload();
        },
      });
    }
  });

  // Delete comment
  $(".close.com").click(function () {
    if (confirm("Are you sure?")) {
      const $card = $(this).closest(".card");
      const $comment = $(this).closest(".cardcom");
      const dtarget = $card.data("postid");
      const index = $(this).data("index");
      $.ajax({
        url: "/posts/comment/" + dtarget + "/" + index,
        type: "DELETE",
        success: function () {
          $comment.remove();
        },
      });
    }
  });

  // Voting on Posts
  $("[data-postID]").each(function (i, e) {
    let userVote = 0;
    if ($(e).find(".cardup").data("toggle")) userVote = 1;
    if ($(e).find(".carddown").data("toggle")) userVote = -1;
    $(e).attr("data-uservote", userVote);
  });

  $("[data-toggle]").click(function (e) {
    e.preventDefault();
    const $card = $(this).closest(".card");
    const postid = $card.data("postid");
    const userVote = parseInt($card.attr("data-uservote"), 10);
    const $karma = $card.find(".cardkarma");
    const newVote = $(this).data("value");
    const $toggles = $card.find("[data-toggle]");
    const wasToggled = $(this).attr("data-toggle") === "true";
    $toggles.attr("data-toggle", false);
    if (wasToggled) {
      $.post("/posts/vote/" + postid, { val: 0 }).then(function () {
        $karma.text(parseInt($karma.text(), 10) - userVote);
        $card.attr("data-uservote", 0);
      });
    } else {
      $.post("/posts/vote/" + postid, { val: newVote }).then(function () {
        const $toggle = $card.find("[data-value='" + newVote + "']");
        $toggle.attr("data-toggle", true);
        $karma.text(parseInt($karma.text(), 10) + (newVote - userVote));
        $card.attr("data-uservote", newVote);
      });
    }
  });

  // Commenting on Posts
  $(".comsubmit").click(function (e) {
    e.preventDefault();
    const $card = $(this).closest(".card");
    const postid = $card.data("postid");
    const $commentBox = $(this).prev();
    const content = $commentBox.val();
    $.post("/posts/comment/" + postid, { content: content }).then(function () {
      $commentBox.val("");
      location.reload();
    });
  });
});
