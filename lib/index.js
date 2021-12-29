const express       = require("express");
const bodyParser    = require("body-parser");
const path          = require("path");

const configRoutes  = require("./routes/config");
const pluginRoutes  = require("./routes/plugin");

const app   = express();
const port  = 1234;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../public")));

app.set("view engine", "ejs");

app.use("/config", configRoutes);
app.use("/", pluginRoutes);

app.listen(port, () => {
  console.info(`Listening on Port: ${port}`);
});
