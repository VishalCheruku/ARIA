require("dotenv").config();

const { createApp } = require("./app");
const { connectDatabase } = require("./services/database");
const copilotRunner = require("./services/copilotRunner");

const port = process.env.PORT || 5000;
const app = createApp();

connectDatabase()
  .finally(() => {
    const server = app.listen(port, () => {
      console.log(`ARIA AI running at http://localhost:${port}`);
    });
    /* A busy port must fail loudly and immediately — without this handler the
       callback never fires, nothing is listening, and only the Copilot's
       bind errors hint at what happened (the Windows co-bind gotcha). */
    server.on("error", error => {
      if (error && error.code === "EADDRINUSE") {
        console.error(
          `ARIA cannot start: port ${port} is already in use — another ARIA ` +
          "dev server is probably still running (stale processes co-bind ports " +
          "on Windows). Stop it first: netstat -ano | findstr :" + port +
          "  then  taskkill /PID <pid> /F  — or start on another port with PORT=<port>."
        );
        process.exit(1);
      }
      throw error;
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
