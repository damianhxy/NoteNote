$(function() {
    // Toggle follow
    $(".cardfollow").click(function() {
        var $cnt = $("#followercount");
        $.post("/users/follow" + $(this).data("ftarget"))
        .done(function() {
            var cf = $(this).get(0);
            if ($(this).data("ftoggle") === true) {
                cf.style.background = "#2ECC71";
                cf.style.boxShadow = "0 3px 0 #27AE60";
                cf.textContent = "Follow";
                $(this).data("ftoggle", false);
                $cnt.text(parseInt($cnt.text()) - 1);
            } else {
                cf.style.background = "#E74C3C";
                cf.style.boxShadow = "0 3px 0 #C0392B";
                cf.textContent = "Unfollow";
                $(this).data("ftoggle", true);
                $cnt.text(parseInt($cnt.text()) + 1);
            }
        });
    });
});
