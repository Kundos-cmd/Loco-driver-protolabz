const dbConfig = require("../config/db.config.js");
const Sequelize = require("sequelize");
const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  dialect: dbConfig.dialect,
  dialectModule: require("mysql2"),
  logging: false,
  pool: {
    max: dbConfig.pool.max,
    min: dbConfig.pool.min,
    acquire: dbConfig.pool.acquire,
    idle: dbConfig.pool.idle,
  },
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.sequelize
  .authenticate()
  .then(() => {
    console.log("Connection has been established successfully 2.");
  })
  .catch((error) => {
    console.error("Unable to connect to the database: ", error);
  });

db.operators = require("./operator.model.js")(sequelize, Sequelize);
db.admins = require("./admin.model.js")(sequelize, Sequelize);
db.companies = require("./company.model.js")(sequelize, Sequelize);

db.sequelize
  .sync({ force: false }) // Set to true to drop and recreate tables
  .then(() => {
    console.log("✅ Tables created successfully.");
  })
  .catch((err) => {
    console.error("❌ Error creating tables:", err);
  });

module.exports = db;
