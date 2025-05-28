const credentials = require("./invoiceCredentials.controller");
var router = require("express").Router();

// Fetch requests
router.get("/get-credentials", credentials.getAllCredentials);
router.get("/get-credential/:id", credentials.getCredentialById);

// Add or post requests
router.post("/add-credential", credentials.addCredential);

// Update requests
router.put("/update-credential/:id", credentials.updateCredential);

// Delete requests
router.delete("/delete-credential/:id", credentials.deleteCredential);

module.exports = router;
