const fs = require("fs");
const path = require("path");

const target = path.join("dist", "index.js");
const shebang = "#!/usr/bin/env node\n";

if (!fs.existsSync(target)) {
  console.error(`Missing build output: ${target}`);
  process.exit(1);
}

const content = fs.readFileSync(target, "utf8");
if (!content.startsWith(shebang)) {
  fs.writeFileSync(target, shebang + content);
}
