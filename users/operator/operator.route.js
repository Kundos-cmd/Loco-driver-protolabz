const verifyToken = require("../../middleware/auth.js");
const operators = require("./operator.controller.js");
const common = require("../common/index.js");
const verification = require("../../utils/verification-request/requestApis.js");
var router = require("express").Router();

// Create a new Tutorial
router.get("/get-operators", verifyToken, operators.findAll);
router.get("/get-every-operator", verifyToken, operators.findAllOfThem);
router.post("/update-avatar", operators.updateAvatar);
// router.get("/get-operators/:id",verifyToken, operators.findOperatorById);
router.get("/get-operator/:id", operators.findOperatorById);
//newOne
router.get("/get-operator-by-chat_id/:chat_id", operators.findOperatorByChatID);

router.get("/delete-operator/:id", operators.deleteOperator);
router.get("/change-status/:id", operators.changeOperatorStatus);
router.post("/signup", operators.createUser);
router.post("/login", operators.loginUser);
router.post("/get-user", operators.getUserByEmail);
router.post("/update-password", operators.updatePassword);
router.put("/edit-operator/:id", operators.editOperator);

//Requests
router.post("/add-request", operators.addRequest);
router.get(
  "/get-request-with-filters/:id",
  operators.getRequestByIdWithFilters
);
router.get(
  "/get-operator-request-stats/:operator_id",
  operators.getDriveRequestStatsByOperatorId
);
router.get("/get-request-by-operator/:id", operators.getRequestByOperatorId);
router.get(
  "/get-request-by-operator/:id/status/:status",
  operators.getRequestByOperatorIdWithStatus
);

//Company
router.get("/get-company/:id/:operatorId", operators.findCompanyById);
router.get("/get-companies/:operatorId", operators.findAllCompanies);
router.post(
  "/get-companies-by-filter-and-calender",
  operators.GetFilterCompaniesWithServicesCalender
);
router.post(
  "/get-companies-by-filter/:operatorId",
  operators.GetFilterCompaniesWithServices
);

//drives
router.get(
  "/get-operator-drives/:operator_id",
  operators.getDrivesByOperatorId
);
router.get(
  "/get-operator-drives/:operatorId/:status",
  operators.getOperatorStatusDrive
);
router.get(
  "/get-operator-drives-stats/:operator_id",
  operators.getDriveStatsByOperatorId
);
router.get(
  "/get-operator-monthly-drive-stats/:operator_id",
  operators.getMonthlyDriveStatsByOperatorId
);
router.post("/get-drives-by-filters", operators.getDynamicDrives);
router.get("/get-drive/:id", operators.getDriveById);
router.put("/end-drive/:id", operators.EndDrive);
router.get("/get-drive-with-filters/:id", operators.getDriveByIdWithFilters);
router.put("/change-drive-status/:id", operators.changeDriveStatus);

//invoices
router.get(
  "/get-operator-invoices-stats/:operator_id",
  operators.getInvoicesStatsByOperatorId
);
router.get(
  "/get-operator-billing-stats/:operator_id",
  operators.getBillingStatsByOperatorId
);
router.get(
  "/get-operator-invoices/:operator_id/duration/:duration",
  operators.getInvoicesByOperatorIdWithDuration
);
router.get(
  "/get-operator-invoices/:operator_id/status/:status",
  operators.getInvoicesByOperatorIdWithStatus
);
router.get(
  "/get-operator-invoices/:operator_id",
  operators.getInvoicesByOperatorId
);
router.get("/get-invoice/:id", operators.getInvoiceByID);
router.get("/get-payment-credentials", operators.getPaymentCredentials);

router.post('/reset-password',operators.resetPassword);
router.post('/verify-token',operators.verifyToken);


//filters
router.get("/get-filters", common.getAllFilters);

//about Us
router.get("/get-about-us/:role/:role_id", common.getAboutUs);
router.post("/edit-about-us/:role/:role_id", common.setAboutUs);

//public views
router.get("/view/company/:companyId", common.getPublicCompanyInfo);
router.get("/view/operator/:operatorId", common.getPublicOperatorInfo);

//verification-requests
router.post("/check-verification-request", verification.checkRequest);
router.post("/submit-verification-request", verification.SubmitRequest);

//Saved Compnies
router.get(
  "/save-company/:operatorId/:companyId/:likeStatus",
  operators.toggleSavedCompany
);

module.exports = router;
