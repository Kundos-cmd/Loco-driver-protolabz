const admins = require("./admin.controller.js");
const verifyToken = require("../../middleware/auth.js");
const common = require("../common/index.js");

let router = require("express").Router();

// Create a new Tutorial

//Admins For Admins
router.get("/get-admins", verifyToken, admins.findAll);
router.get("/get-admin/:id", verifyToken, admins.findById);
router.get("/delete-admin/:id",verifyToken, admins.deleteAdmin);
router.get("/get-company-requests/:status",admins.getCompanyRequests);
router.get("/get-operator-requests/:status",admins.getOperatorRequests);
router.post("/signup", verifyToken, admins.createUser);
router.post("/login", admins.loginUser);
router.post("/get-admin-by-email", admins.getUserByEmail);
router.post("/update-password", admins.updatePassword);
router.put("/edit-admin/:id", admins.editAdmin);
router.get('/getChatId/:id', admins.getCometChatId);

router.post('/verify-token',admins.verifyToken);
router.post('/reset-password',admins.resetPassword);


//Companies For Admins

router.get("/get-companies", verifyToken, admins.findAllCompanies);
router.get("/get-company/:id", verifyToken, admins.findCompanyById);
router.get('/change-company-status/:id', verifyToken,admins.changeCompanyStatus);
router.get("/delete-company/:id",verifyToken,admins.deleteCompany);

//Drivers for admins
router.get("/get-driver-companies", verifyToken, admins.getDriverCompanies);
router.get("/get-drivers-by-company/:id", verifyToken, admins.getDriversByCompanyID);
router.get("/get-driver/:id",admins.getDriverByID);
router.get('/get-drives/:id', admins.getDrivesByDriverID);

//
router.get('/get-user-stats', admins.getUserStats);

//Manage Drives
router.get("/get-drives", admins.getDrives);
router.get('/get-drive/:id', admins.getDriveById);
router.get('/get-recent-drives', admins.getRecentDrives);
router.get('/get-drives-stats', admins.getDriveStats);
router.get("/get-drives/status/:status", admins.getStatusDrives);
router.put('/update-payment-status-drive/:id', admins.changePaymentStatusDrive);
router.post("/get-drives-by-filters",admins.getDynamicDrives);

//Operators
router.get("/get-operators",  admins.findAllOperators);
router.get("/get-operator/:id", admins.findOperatorById);
router.get("/delete-operator/:id", admins.deleteOperator);
router.get('/change-operator-status/:id', admins.changeOperatorStatus);


//Invoices
router.get('/get-invoice-credential', admins.getInvoiceCredential);
router.get("/get-invoices-all", admins.getAllInvoices);
router.get("/get-invoices-stats", admins.getInvoiceStats);
router.get("/get-monthly-invoice-stats", admins.getMonthlyInvoiceStats);
router.get("/get-invoice/:id", admins.getInvoiceByID);
router.get("/get-recent-invoices", admins.getRecentInvoices);
router.post("/add-invoice", admins.addInvoice);
router.post("/insert-invoice", verifyToken, admins.insertInvoice);
router.post("/send-invoice", admins.sendInvoice);
router.delete("/delete-invoice/:id", admins.deleteInvoice);
router.put("/update-invoice/:id", admins.updateInvoiceAndDrivePayment);

//Manage Filters
router.get('/get-filters', admins.getAllFilters);
router.get('/get-filter/:id', admins.getFilterById);
router.post('/add-filter', admins.addFilter);
router.put('/update-filter/:id', admins.updateFilter);
router.delete('/delete-filter/:id', admins.deleteFilter);


//Manage invoice Credentials
router.get("/get-credentials", admins.getAllCredentials);
router.get("/get-credential/:id", admins.getCredentialById);
router.post("/add-credential", admins.addCredential);
router.put("/update-credential/:id", admins.updateCredential);
router.delete("/delete-credential/:id", admins.deleteCredential);



//Manage Faq
router.post("/add-faq", admins.addFaq);
router.get("/get-faqs", admins.getFaqs);
router.get("/get-faq/:id", admins.getFaqById);
router.put("/update-faq/:id", admins.updateFaq);
router.delete("/delete-faq/:id", admins.deleteFaq);




//about-us
router.get("/get-about-us/:role/:role_id", common.getAboutUs);
router.post("/edit-about-us/:role/:role_id", common.setAboutUs);

//public views
router.get("/view/company/:companyId", common.getPublicCompanyInfo);
router.get("/view/operator/:operatorId", common.getPublicOperatorInfo);

// router.post("/update-admin",verifyToken, admins.updateAdmin);

module.exports = router;