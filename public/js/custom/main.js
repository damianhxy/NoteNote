$(function() {
    console.info("[info] main.js is now running");

    // Delete Post
    $(".close:not(.com)").click(function() {
        if (confirm("Are you sure?")) {
            var $card = $(this).closest(".card");
            var dtarget = $card.data("postid");
            $.ajax({
                url: "/posts/" + dtarget,
                type: "DELETE",
                success: function() {
                    $card.remove();
                    if (!$("[data-postID]").length)
                        location.reload();
                }
            });
        }
    });

    // Delete comment
    $(".close.com").click(function() {
        if (confirm("Are you sure?")) {
            var $card = $(this).closest(".card");
            var $comment = $(this).closest(".cardcom");
            var dtarget = $card.data("postid");
            var index = $(this).data("index");
            $.ajax({
                url: "/posts/comment/" + dtarget + "/" + index,
                type: "DELETE",
                success: function() {
                    $comment.remove();
                }
            });
        }
    });

    // Voting on Posts
    $("[data-postID]").each(function(i, e) {
        var userVote = 0;
        if ($(e).find(".cardup").data("toggle"))
            userVote = 1;
        if ($(e).find(".carddown").data("toggle"))
            userVote = -1;
        $(e).attr("data-uservote", userVote);
    });

    $("[data-toggle]").click(function(e) {
        e.preventDefault();
        var $card = $(this).closest(".card");
        var postid = $card.data("postid");
        var userVote = $card.attr("data-uservote");
        var $karma = $card.find(".cardkarma");
        var newVote = $(this).data("value");
        // Clear both
        var $toggles = $card.find("[data-toggle]");
        var wasToggled = $(this).attr("data-toggle") === "true"; // attr gives string
        $toggles.attr("data-toggle", false);
        if (wasToggled) {
            $.post("/posts/vote/" + postid, { val: 0 })
            .then(function() {
                $karma.text(parseInt($karma.text()) - userVote);
                $card.attr("data-uservote", 0);
            });
        } else {
            $.post("/posts/vote/" + postid, { val: newVote })
            .then(function() {
                $toggle = $card.find("[data-value='" + newVote + "']");
                $toggle.attr("data-toggle", true);
                $karma.text(parseInt($karma.text()) + (newVote - userVote));
                $card.attr("data-uservote", newVote);
            });
        }
    });

    // Commenting on Posts
    $(".comsubmit").click(function(e) {
        e.preventDefault();
        var $card = $(this).closest(".card");
        var postid = $card.data("postid");
        var $commentBox = $(this).prev();
        var content = $commentBox.val();
        $.post("/posts/comment/" + postid, { content: content })
        .then(function() {
            $commentBox.val("");
            location.reload();
        });
    });
});
