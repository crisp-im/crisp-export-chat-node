const express       = require("express");

const authenticate  = require("../middleware/authenticate");
const handle        = require("../handle");

const router = express.Router();

router.get("/", authenticate, handle.getConfiguration);

router.post("/update", authenticate, handle.putConfigurationUpdate);

router.get("/success", authenticate, handle.getConfigSuccess);

// router.get("/fail", //TODO );

module.exports = router;