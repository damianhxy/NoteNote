$(function() {
    console.info("[info] upload.js is now running");
    $("#addbtn").click(function() {
        $("#file").click();
    });

    // File Name Text
    $("#file").change(function() {
        var name = $("#file").get(0).files.item(0).name;
        $(".addfilename").val(name);
    })
});
