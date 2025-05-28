const calendars = require("./calendars.controller.js");


var router = require("express").Router();

// Create a new Tutorial
router.get("/get-events/:id", calendars.getEvents);
router.post("/add-event", calendars.addEvent);
router.put("/update-event/:id", calendars.editEvent);
router.delete("/delete-event/:id", calendars.deleteEvent);

module.exports = router;