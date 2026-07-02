const fs = require('fs');
let code = fs.readFileSync('dashboard.html', 'utf-8');

const errHandler = `
<script>
window.addEventListener("error", function(e) {
    document.body.insertAdjacentHTML("afterbegin", "<div style='position:fixed;top:0;left:0;right:0;background:red;color:white;z-index:9999999;padding:20px;font-size:16px;'>Uncaught Error: " + e.message + " at " + e.filename + ":" + e.lineno + "</div>");
});
window.addEventListener("unhandledrejection", function(e) {
    document.body.insertAdjacentHTML("afterbegin", "<div style='position:fixed;top:0;left:0;right:0;background:red;color:white;z-index:9999999;padding:20px;font-size:16px;'>Unhandled Rejection: " + e.reason + "</div>");
});
</script>
</head>
`;

code = code.replace("</head>", errHandler);
fs.writeFileSync('dashboard.html', code);
console.log("Injected error handler!");
