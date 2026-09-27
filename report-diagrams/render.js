/* Render SVG diagrams to 2x PNG via headless Chrome */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SVG = path.join(__dirname, "svg");
const PNG = path.join(__dirname, "png");
fs.mkdirSync(PNG, { recursive: true });

const dims = {
  "4.1-class-diagram": [1690, 1150],
  "4.2-use-case-diagram": [1560, 1080],
  "4.3-admin-activity-diagram": [1240, 1440],
  "4.4-user-activity-diagram": [1240, 1980],
  "4.5-sequence-diagram": [1660, 1250],
  "4.6-system-architecture": [1600, 1215],
  "4.7-deployment-diagram": [1600, 940],
  "4.8-component-diagram": [1600, 1130],
};

for (const [name, [w, h]] of Object.entries(dims)) {
  const src = "file:///" + path.join(SVG, `${name}.svg`).replace(/\\/g, "/");
  const out = path.join(PNG, `${name}.png`);
  execFileSync(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    "--default-background-color=FFFFFFFF",
    `--screenshot=${out}`,
    `--window-size=${w},${h}`,
    src,
  ], { stdio: "ignore", timeout: 60000 });
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`${name}.png  ${kb} KB`);
}
console.log("render done");
