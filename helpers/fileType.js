module.exports = function (url) {
  const files = [
    { pattern: "xlsx?", icon: "excel" },
    { pattern: "pptx?", icon: "powerpoint" },
    { pattern: "docx?", icon: "word" },
    { pattern: "pdf", icon: "pdf" },
    { pattern: "(png|jpe?g|gif)", icon: "picture" },
    { pattern: "(zip|rar|7z)", icon: "zip" },
  ];
  let icon = "file-text-o";
  if (url.indexOf("http") === 0) return "cloud";
  files.forEach(function (e) {
    if (RegExp(e.pattern).test(url.split(".").pop())) icon = "file-" + e.icon + "-o";
  });
  return icon;
};
