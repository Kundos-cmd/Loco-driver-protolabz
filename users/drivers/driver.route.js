const drivers = require("./driver.controller");

var router = require("express").Router();

// Driver Routes 

router.get("/get-driver/:id",drivers.getDriverByID);
router.get('/get-drives/:id', drivers.getDrivesByDriverID);
router.get("/get-companies",drivers.getCompanies);
router.get("/get-drivers",drivers.getDrivers);
router.get("/get-drivers-by-company/:id",drivers.getDriversByCompanyID );
router.post("/add-driver",drivers.addDriver);
router.put("/update-driver/:id",drivers.updateDriver);
//router.delete("/delete-driver",drivers.deleteDriver);

module.exports = router;