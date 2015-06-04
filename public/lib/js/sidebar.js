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
    document.getElementById("fakeaf").onclick = function(){
		document.getElementById("af").click();
	}
	
	document.getElementById("af").onchange = function(){
		document.querySelector(".addfilename").textContent = document.getElementById("af").value.split("\\").pop() || "Your file name will appear here";
	}
	
	document.querySelector("[data-toggle='true']").style.color = "#fff";
	
	function up(id, parent){
		var x = parent.querySelector(".cardup"),
			y = parent.querySelector(".carddown"),
			z = parent.querySelector("span");
		if(x.dataset.toggle == "false" && y.dataset.toggle == "true"){
			x.style.color = "#fff";
			y.style.color = "";
			z.textContent = +z.textContent +2;
			post("up",id);
		}
		else if(x.dataset.toggle == "false" && y.dataset.toggle == "false"){
			x.style.color = "#fff";
			y.style.color = "";
			z.textContent = +z.textContent +1;
			post("up",id);
		}
		else{
			x.style.color = "";
			post("un",id);
		}
	}
	
	function down(id, parent){
		var x = parent.querySelector(".cardup"),
			y = parent.querySelector(".carddown"),
			z = parent.querySelector("span");
		if(y.dataset.toggle == "false" && x.dataset.toggle == "true"){
			y.style.color = "#fff";
			x.style.color = "";
			z.textContent = +z.textContent -2;
			post("up",id);
		}
		else if(y.dataset.toggle == "false" && x.dataset.toggle == "false"){
			y.style.color = "#fff";
			x.style.color = "";
			z.textContent = +z.textContent -1;
			post("up",id);
		}
		else{
			y.style.color = "";
			post("un",id);
		}
	}
	
	//ajax (delete/vote/follow)
	function post(action, subject){
		var xmlhttp, url, up;
		if (window.XMLHttpRequest)
			xmlhttp=new XMLHttpRequest();
		else
			xmlhttp=new ActiveXObject("Microsoft.XMLHTTP");
		
		if(action === 'd'){
			url = "/deletepost";
			up = "postID="+subject;
		}
		else if(action === 'up'){
			url = "/vote";
			up = "value=1&postID="+subject;
		}
		else if(action === 'un'){
			url = "/vote";
			up = "value=0&postID="+subject;
		}
		else if(action === 'do'){
			url = "/vote";
			up = "value=-1&postID="+subject;
		}
		else if(action === 'f'){
			url = "/follow",
			up = "userID="+subject;
		}
		
		xmlhttp.onreadystatechange = function(){
			if(xmlhttp.readyState == 4 && xmlhttp.status = 200) 
				//perform action
		}
		xmlhttp.open("POST",url,true);
		xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
		xmlhttp.send(up);
	}
}