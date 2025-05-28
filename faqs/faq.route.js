const faqs = require("./faq.controller.js");
var router = require("express").Router();

// Create a new FAQ
router.post("/add-faq", faqs.addFaq);

// Retrieve all FAQs
router.get("/get-faqs", faqs.getFaqs);

// Retrieve a single FAQ by ID
router.get("/get-faq/:id", faqs.getFaqById);

// Update an FAQ by ID
router.put("/update-faq/:id", faqs.updateFaq);

// Delete an FAQ by ID
router.delete("/delete-faq/:id", faqs.deleteFaq);

module.exports = router;
