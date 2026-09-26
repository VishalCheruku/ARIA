require("dotenv").config();

const { createApp } = require("./app");
const { connectDatabase } = require("./services/database");

const port = process.env.PORT || 5000;
const app = createApp();

connectDatabase().finally(() => {
  app.listen(port, () => {
    console.log(`ARIA AI running at http://localhost:${port}`);
  });
});
