const drives = require("./drives.controller.js");

var router = require("express").Router();

// Create a new Tutorial

// Fetch requests Entertain here
router.get("/get-drives", drives.getDrives);
router.get("/get-drive/:id",drives.getDriveById);
router.get("/get-company-drives/:companyId",drives.getDrivesByCompanyId);
router.get("/get-company-drives/:companyId/:status",drives.getCompanyStatusDrive);
router.get("/get-drives/:status",drives.getStatusDrives);
router.get("/get-operator-drives/:operator_id",drives.getDrivesByOperatorId);
router.get("/get-driver-drives/:driver_id",drives.getDrivesByDriverId);
router.post("/get-by-filters",drives.getDynamicDrives);
router.post("/add-drive", drives.addDrive);

// Add or post requests Entertain here
router.put("/update-drive/:id", drives.editDrive);
router.put('/update-payment-status-drive/:id', drives.changePaymentStatusDrive);


//new One
router.get("/get-operator-drives/:operatorId/:status",drives.getOperatorStatusDrive);
router.get('/get-drive-with-filters/:id', drives.getDriveByIdWithFilters);
router.put('/change-status/:id', drives.changeDriveStatus);
router.put('/end-drive/:id', drives.EndDrive);
router.put('/cancel-drive/:id', drives.cancelDrive);
module.exports = router;

//Branch Created