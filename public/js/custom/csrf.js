// Send the per-session CSRF token with every jQuery AJAX request.
$.ajaxSetup({
  beforeSend: function (xhr) {
    xhr.setRequestHeader("X-CSRF-Token", $('meta[name="csrf-token"]').attr("content"));
  },
});
