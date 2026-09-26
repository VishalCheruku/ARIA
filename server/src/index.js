require("dotenv").config();

const { createApp } = require("./app");
const { connectDatabase } = require("./services/database");
const copilotRunner = require("./services/copilotRunner");

const port = process.env.PORT || 5000;
const app = createApp();

connectDatabase()
  .finally(() => {
    app.listen(port, () => {
      console.log(`ARIA AI running at http://localhost:${port}`);
    });
    /* The Copilot starts alongside the main app and runs like any other
       feature; if it fails, the runner logs and the dashboard continues. */
    copilotRunner.start().catch(error => {
      console.error("[copilot] unexpected startup failure (main app unaffected):", error.message);
    });
  });

/* Take the Copilot child process down with us, cleanly. */
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    copilotRunner.stop().finally(() => process.exit(0));
  });
}
