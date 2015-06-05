window.onload = function () {
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

    //style file upload
    if (document.getElementById("fakeaf")) {
        document.getElementById("fakeaf").onclick = function(){
    		document.getElementById("af").click();
    	}

    	document.getElementById("af").onchange = function(){
    		document.querySelector(".addfilename").textContent = document.getElementById("af").value.split("\\").pop()
                || "Your file name will appear here";
    	}
    }

    //style votes
    var active = document.querySelectorAll("[data-toggle='true']");
    Array.prototype.forEach.call(active, function(e) {
        e.style.color = "#fff";
    });

    //vote button style change
    var voteButtons = document.querySelectorAll("[data-toggle]");
    Array.prototype.forEach.call(voteButtons, function(e) {
        e.addEventListener("click", function(f) {
            f.preventDefault();
            var res = e.dataset.value; // Value of option picked
            var change = 0; // Difference
            var sibling = e.className === "cardup" ? e.nextElementSibling : e.previousElementSibling;
            if (sibling.dataset.toggle === "true") { // Toggle off sibling
                sibling.dataset.toggle = "false";
                sibling.style.color = ""; // Turn it blank
                e.dataset.toggle = "true";
                e.style.color = "#fff";
                change = e.dataset.value - sibling.dataset.value;
                res = e.dataset.value;
            } else { // Toggle current
                if (e.dataset.toggle === "true") {
					change = 0 - e.dataset.value;
					e.style.color = "";
					e.dataset.toggle = "false";
                    res = 0;
				}
				else {
					change = e.dataset.value;
					e.style.color = "#fff";
					e.dataset.toggle = "true";
                    res = e.dataset.value;
                }
            }
            // Modify karma
            var karma = e.parentNode.firstElementChild,
				karma2 = document.getElementById("karmacount");
            karma.textContent = parseInt(karma.textContent) + parseInt(change); // Update karma value
            if(karma2) karma2.textContent = parseInt(karma2.textContent) + parseInt(change); // Update karma value
            var data = "postID=" + e.parentNode.parentNode.dataset.id + "&value=" + res;
            POST("/vote", data, function(g) {
                if (!g) {
                    alert("Error encountered while recording vote");
                    // Error, revert?
                }
                else {
					console.log(g);
				}
            });
        });
    });

	//delete post
	function del(object){
		POST("/deletepost", "postID=" + object.dataset.id, function(g) {
			if (!g) {
                alert("Error encountered while deleting");
            }
            else {
                object.style.opacity = 0;
                setTimeout(function(g) {
                    if (object.removeNode)
    					object.removeNode();
    				else
    					object.remove();
                    document.querySelector(".cardbox").innerHTML += '<div class="card load">There are no notes</div>';
			     }, 300);
            }
		});
	}

	var closes = document.querySelectorAll("a.close");
	Array.prototype.forEach.call(closes, function(e) {
        e.addEventListener("click", function() {
			del(e.parentElement)
		});
    });

	var cf = document.querySelector(".cardfollow");
	if(cf){
		if(cf.dataset.ftoggle === "true"){
			cf.style.background = "#E74C3C";
			cf.style.boxShadow = "0 3px 0 #C0392B";
			cf.textContent="Unfollow";
		}
		cf.addEventListener("click", function(f) {
			f.preventDefault();
			var fo = document.getElementById("followercount");
			var data = "userID=" + cf.dataset.ftarget;
			POST("/follow", data, function(g) {
				if (!g) {
					alert("Error encountered while recording follow");
					// Error, revert?
				}
				else if (cf.dataset.ftoggle === "true") {
					cf.style.background = "#2ECC71";
					cf.style.boxShadow = "0 3px 0 #27AE60";
					cf.textContent="Follow";
					cf.dataset.ftoggle = "false";
					if(fo)
						fo.textContent = parseInt(fo.textContent) - 1;
				}
				else {
					cf.style.background = "#E74C3C";
					cf.style.boxShadow = "0 3px 0 #C0392B";
					cf.textContent="Unfollow";
					cf.dataset.ftoggle = "true";
					if(fo)
						fo.textContent = parseInt(fo.textContent) + 1;
				}
			});
		});
	}

	var cc = document.querySelectorAll(".cardcom .comsubmit");
	if(cc) Array.prototype.forEach.call(cc, function(e) {
        e.addEventListener("click", function(f) {
			var v = e.previousElementSibling;
			POST("/addcomment","comment=" + v.value + "&postID=" + e.dataset.ctarget, function(g) {
				var d = document.createElement("div");
				d.className += "cardcom";
                g = JSON.parse(g);
                g.date = moment(g.date).format("DD MMMM YYYY, h:mm:ss a");
				d.innerHTML = '<div class="compic" style="background:'+g.icon+'"></div> <a href="/profile/'+g.user+'" class="comname">'+g.user+'</a> <p class="comdate">'+g.date+'</p><p class="comcontent">'+g.text+'</p><a href="#" class="comclose" data-dtarget="'+g.id+'"></a></div>';
                v.value = "";
				e.parentElement.previousElementSibling.appendChild(d);
			});
		})
	});

    function POST(url, data, callback) {
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.open("POST", url, callback);
        xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState === 4) {
                if (xmlhttp.status !== 200){
                    return callback(null);
				}
                else
                    return callback(xmlhttp.responseText);
            }
        };
        xmlhttp.send(data);
    }
}