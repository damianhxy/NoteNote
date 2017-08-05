$(function() {
    window.overlay = false;
    var $overlay = $("<div>", { id: "chassisblack" });
    $("body").append($overlay);
    var $sidebar = $("#sidebar-left");

    function f() {
		mq = window.matchMedia('(max-width: 780px)').matches;
        if (mq) {
            if (!window.overlay) {
                $sidebar.css("transform", "translateY(30em)");
                $overlay.css("opacity", 0.5);
                $overlay.css("zIndex", 1);
            } else {
                $sidebar.css("transform", "translateY(-30em)");
                $overlay.css("opacity", 0);
                $overlay.css("zIndex", -1);
            }
            window.overlay ^= true;
        }
    }
    $("#branding").click(f);
    $overlay.click(f);
});
