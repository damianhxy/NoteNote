$(function() {
    window.o = true;
    var d = document.createElement('div');
    d.setAttribute("id","chassisblack");
    document.body.appendChild(d);
    var s = document.getElementById("sidebar-left");

    function f() {
		mq = window.matchMedia('(max-width: 780px)').matches;
        if (mq) {
            if (window.o) {
                s.style.webkitTransform = "translateY(30em)";
                s.style.MozTransform = "translateY(30em)";
                s.style.msTransform = "translateY(30em)";
                s.style.OTransform = "translateY(30em)";
                s.style.transform = "translateY(30em)";
                d.style.zIndex = "1";
                d.style.opacity = "0.5";
                window.o = false;
            } else {
                s.style.webkitTransform = "translateY(-30em)";
                s.style.MozTransform = "translateY(-30em)";
                s.style.msTransform = "translateY(-30em)";
                s.style.OTransform = "translateY(-30em)";
                s.style.transform = "translateY(-30em)";
                d.style.opacity = "0";
                d.style.zIndex = "-1";
                window.o = true;
            }
        }
    }
    document.getElementById("branding").onclick = function(){f()};
    d.onclick = function(){if(!window.o)f()};
});
