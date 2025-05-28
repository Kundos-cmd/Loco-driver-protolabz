const express = require('express');
const router = express.Router();
const filters = require('./filter.controller');

// Route to get all filters
router.get('/get-filters', filters.getAllFilters);

// Route to get a filter by ID
router.get('/get-filter/:id', filters.getFilterById);

// Route to add a new filter
router.post('/add-filter', filters.addFilter);

// Route to update an existing filter
router.put('/update-filter/:id', filters.updateFilter);

// Route to delete a filter
router.delete('/delete-filter/:id', filters.deleteFilter);

module.exports = router;
