/* Build all report diagram SVGs */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "svg");
fs.mkdirSync(OUT, { recursive: true });

const diagrams = [
  ["4.1-class-diagram", require("./d1-class")],
  ["4.2-use-case-diagram", require("./d2-usecase")],
  ["4.3-admin-activity-diagram", require("./d3-admin-activity")],
  ["4.4-user-activity-diagram", require("./d4-user-activity")],
  ["4.5-sequence-diagram", require("./d5-sequence")],
  ["4.6-system-architecture", require("./d6-architecture")],
  ["4.7-deployment-diagram", require("./d7-deployment")],
  ["4.8-component-diagram", require("./d8-component")],
];

for (const [name, mod] of diagrams) {
  const svg = mod.build();
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
  console.log(`${name}.svg  (${mod.W}x${mod.H})`);
}
console.log("done");
