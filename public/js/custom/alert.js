$(function () {
  const $ohsnap = $("#ohsnap");
  const error = $ohsnap.data("error");
  const success = $ohsnap.data("success");
  if (error) ohSnap(error, { color: "red" });
  else if (success) ohSnap(success, { color: "green" });
});
