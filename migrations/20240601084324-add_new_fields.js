"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn("companies", "status", {
        type: Sequelize.STRING,
        isIn: [["verified", "pending", "rejected", "in review", "blocked"]],
        allowNull: false,
        defaultValue: "pending",
      }),
      queryInterface.addColumn("operators", "status", {
        type: Sequelize.STRING,
        isIn: [["verified", "pending", "rejected", "in review", "blocked"]],
        allowNull: false,
        defaultValue: "pending",
      }),
    ]);
  },

  async down(queryInterface, Sequelize) {
   
  },
};
