const invoices = require("./invoice.controller");

let router = require("express").Router();

//Altered routes or controllers
router.get("/get-invoice/:id", invoices.getInvoiceByID);
router.put("/update-invoice/:id", invoices.updateInvoiceAndDrivePayment);

// Invoice Routes
router.get("/get-all", invoices.getAllInvoices);
router.get("/get-stats", invoices.getInvoiceStats);
router.get("/get-invoice/:id", invoices.getInvoiceByID);
router.get("/get-recent-invoices", invoices.getRecentInvoices);
router.get("/get-invoices/:id", invoices.getAllInvoicesInTable);
router.post("/add-invoice", invoices.addInvoice);
// router.put("/update-invoice-drive/:id", invoices.updateInvoiceAndDrivePrice);
// router.put("/update-invoice/:id", invoices.updateInvoice);
router.delete("/delete-invoice/:id", invoices.deleteInvoice);
//Company Invoices
router.get("/get-company-invoices/:company_id", invoices.getInvoicesByCompanyId);
router.get("/get-company-invoices/:company_id/status/:status", invoices.getInvoicesByCompanyIdWithStatus);
router.get("/get-company-invoices/:company_id/duration/:duration", invoices.getInvoicesByCompanyIdWithDuration);
//Operator invoices
router.get("/get-operator-invoices/:operator_id/duration/:duration", invoices.getInvoicesByOperatorIdWithDuration);
router.get("/get-operator-invoices/:operator_id/status/:status", invoices.getInvoicesByOperatorIdWithStatus);
router.get("/get-operator-invoices/:operator_id", invoices.getInvoicesByOperatorId);

module.exports = router;
