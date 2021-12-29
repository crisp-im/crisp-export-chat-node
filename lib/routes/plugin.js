const express       = require("express");
const authenticate  = require("../middleware/authenticate");
const handle        = require("../handle");

const router        = express.Router();

router.get("/profile", authenticate, handle.getProfile);

router.post("/export", authenticate, handle.postExport);

module.exports = router;