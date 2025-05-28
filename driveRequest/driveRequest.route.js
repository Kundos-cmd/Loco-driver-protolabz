const express = require('express');
const router = express.Router();
const requestController = require('./driveRequest.controller');

// Add a new request
router.post('/add-request', requestController.addRequest);

// Delete a request by ID
router.delete('/delete-request/:id', requestController.deleteRequest);

// Update a request by ID
router.put('/update-request/:id', requestController.updateRequest);

// Get all requests
router.get('/get-requests', requestController.getAllRequests);

// Get a single request by ID
router.get('/get-request/:id', requestController.getRequestById);
router.get('/get-request-by-operator/:id', requestController.getRequestByOperatorId);
router.get('/get-request-by-company/:id', requestController.getRequestByCompanyId);

router.get('/get-request-with-filters/:id', requestController.getRequestByIdWithFilters);
router.put('/reject-request/:id', requestController.RejectRequestById);

//new One
router.get('/get-request-by-operator/:id/status/:status', requestController.getRequestByOperatorIdWithStatus);
router.get('/get-requests/company/:company_id/operator/:operator_id', requestController.getDriveRequestsByCompanyWithOperator);
router.get('/get-requests/initiation/company/:company_id/operator/:operator_id', requestController.getDriveInitiationRequestsByCompanyWithOperator);
router.get('/change-status/:id/:status', requestController.ChangeStatusByID);
router.get('/get-request-by-company/:id/status/:status', requestController.getRequestByCompanyIdWithStatus);



//Obsoleted Routes
/*
router.get('/get-request-by-company/:id/view-reply/:view/:reply', requestController.getRequestByCompanyIdWithViewReply);
router.get('/get-request-by-company/:id/view/:view', requestController.getRequestByCompanyIdWithViewStatus);
router.get('/get-request-by-company/:id/reply/:reply', requestController.getRequestByCompanyIdWithReply);
router.get('/change-view/:id/:view', requestController.ChangeViewByID);
router.get('/change-reply/:id/:reply', requestController.ChangeReplyByID);
*/


module.exports = router;
