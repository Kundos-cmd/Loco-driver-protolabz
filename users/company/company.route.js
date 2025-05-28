const verifyToken = require("../../middleware/auth.js");
const companies = require("./company.controller.js");
const common = require("../common/index.js");
const verification = require("../../utils/verification-request/requestApis.js");
var router = require("express").Router();

router.get("/get-companies", companies.findAll);
router.get("/get-company/:id", companies.findCompanyById);
router.post("/update-avatar", companies.updateAvatar);
router.get(
  "/get-company-with-services/:company_id",
  verifyToken,
  companies.GetCompanyByIdWithServices
);
router.get("/delete-company/:id", verifyToken, companies.deleteCompany);
router.post("/signup", companies.createUser);
router.post("/login", companies.loginUser);
router.post("/get-user", companies.getUserByEmail);
router.post("/update-password", companies.updatePassword);
router.get("/get-drivers/:id", companies.getDrivers);
router.get("/change-status/:id", companies.changeCompanyStatus);
router.post(
  "/get-companies-by-filter-and-calender",
  companies.GetFilterCompaniesWithServicesCalender
);
router.post(
  "/get-companies-by-filter",
  companies.GetFilterCompaniesWithServices
);
router.put("/edit-company/:id", companies.editCompany);
router.get("/get-company-by-chat_id/:chat_id", companies.findCompanyByChatID);

router.post('/reset-password',companies.resetPassword);
router.post('/verify-token',companies.verifyToken);
//Drivers for company
router.put("/edit-driver/:driverId", companies.updateDriver);
router.get("/get-drivers-by-company/:id", companies.getDriversByCompanyID);
router.get(
  "/get-company-driver-stats/:id",
  companies.getDriverStatsByCompanyID
);
router.get("/get-driver/:id", companies.getDriverByID);
router.get("/get-drives/:id", companies.getDrivesByDriverID);

//Drives for company
router.get("/get-drive/:id", companies.getDriveById);
router.get("/get-company-drives/:companyId", companies.getDrivesByCompanyId);
router.get(
  "/get-company-drives/:companyId/status/:status",
  companies.getCompanyStatusDrive
);
router.get(
  "/get-company-drives-stats/:company_id",
  companies.getDriveStatsByCompanyId
);
router.get(
  "/get-company-monthly-drive-stats/:company_id",
  companies.getMonthlyDriveStatsByCompanyId
);
router.post("/get-drives-by-filters", companies.getDynamicDrives);
router.get("/get-drive-with-filters/:id", companies.getDriveByIdWithFilters);
router.put("/end-drive/:id", companies.EndDrive);
router.put("/cancel-drive/:id", companies.cancelDrive);
router.post("/add-drive", companies.addDrive);
router.put("/update-drive/:id", companies.editDrive);
router.put("/change-drive-status/:id", companies.changeDriveStatus);

//Requests for company
router.get(
  "/get-request-stats-by-company/:id",
  companies.getRequestStatsByCompanyId
);
router.get(
  "/get-company-request-stats/:company_id",
  companies.getDriveRequestStatsByCompanyId
);
router.get(
  "/get-company-monthly-request-stats/:company_id",
  companies.getMonthlyDriveRequestStatsByCompanyId
);
router.get("/get-request-by-company/:id", companies.getRequestByCompanyId);
router.get("/change-request-status/:id/:status", companies.ChangeStatusByID);
router.get(
  "/get-request-with-filters/:id",
  companies.getRequestByIdWithFilters
);
router.put("/reject-request/:id", companies.RejectRequestById);
router.get(
  "/get-request-by-company/:id/status/:status",
  companies.getRequestByCompanyIdWithStatus
);
router.get(
  "/get-requests/:company_id/operator/:operator_id",
  companies.getDriveRequestsByCompanyWithOperator
);
router.get(
  "/get-requests/:company_id/initiation/operator/:operator_id",
  companies.getDriveInitiationRequestsByCompanyWithOperator
);
router.get(
  "/about-us/:role/:role_id",
  companies.getDriveInitiationRequestsByCompanyWithOperator
);

//getRole
router.get("/get-role/:chat_id", companies.getRole);

//Operator for company
router.get("/get-operator/:id", companies.findOperatorById);

//invoices for company
router.get("/get-invoice/:id", companies.getInvoiceByID);
router.post("/add-invoice", companies.addInvoice);
router.get("/get-invoice-by-drive-id/:drive_id", companies.checkInvoiceByDriveId)
router.get(
  "/get-company-invoices/:company_id",
  companies.getInvoicesByCompanyId
);
router.get(
  "/get-company-invoices-stats/:company_id",
  companies.getInvoicesStatsByCompanyId
);
router.get(
  "/get-company-payment-stats/:company_id",
  companies.getPaymentStatsByCompanyId
);
router.get(
  "/get-company-invoices/:company_id/status/:status",
  companies.getInvoicesByCompanyIdWithStatus
);
//about us
router.get("/get-about-us/:role/:role_id", common.getAboutUs);
router.post("/edit-about-us/:role/:role_id", common.setAboutUs);
//router.get('/get-company-password/:id', companies.getCompanyWithPassword)
// router.post('/get-companies-by-filter', companies.UpdatedFilterCompanies);
// router.post('/get-companies-by-filter', companies.filterCompanies);
// router.post('/get-companies-by-filter-model-less', companies.filterModelLessCompanies);

//public views
router.get("/view/company/:companyId", common.getPublicCompanyInfo);
router.get("/view/operator/:operatorId", common.getPublicOperatorInfo);

//Verification Requests
router.post("/check-verification-request", verification.checkRequest);
router.post("/submit-verification-request", verification.SubmitRequest);
//filters
router.get("/get-filters", common.getAllFilters);

//setup
router.post("/setup/:companyId", companies.setupCompanyInfo);

module.exports = router;
