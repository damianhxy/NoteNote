$(function() {
    console.info("[info] main.js is now running");

    // Delete Post
    $(".close").click(function() {
        var dtarget = $(this).data("dtarget");
        $.ajax({
            url: "/posts/" + dtarget,
            type: "DELETE",
            success: function() {
                location.reload();
            }
        });
    })

    // Voting on Posts
});
