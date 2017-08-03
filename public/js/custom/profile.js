$(function() {
    console.info("[info] profile.js is now running");

    // Set follow
    function updateFollowStatus() {
        var $cf = $(".cardfollow");
        if ($cf.data("ftoggle")) {
            $cf.css("background", "#E74C3C");
            $cf.css("boxShadow", "0 3px 0 #C0392B");
            $cf.text("Unfollow");
        } else {
            $cf.css("background", "#2ECC71");
            $cf.css("boxShadow", "0 3px 0 #27AE60");
            $cf.text("Follow");
        }
    }

    // Toggle follow
    $(".cardfollow").click(function() {
        var $cf = $(".cardfollow");
        var $cnt = $("#followercount");
        $.post("/users/follow/" + $(this).data("ftarget"))
        .done(function() {
            if ($cf.data("ftoggle")) {
                $cnt.text(parseInt($cnt.text()) - 1);
                $cf.data("ftoggle", false);
            } else {
                $cnt.text(parseInt($cnt.text()) + 1);
                $cf.data("ftoggle", true);
            }
            updateFollowStatus();
        });
    });

    updateFollowStatus();
});
