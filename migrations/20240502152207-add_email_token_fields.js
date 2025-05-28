"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn("admins", "emailToken", {
        type: Sequelize.STRING,
        allowNull: false
      }),
      queryInterface.addColumn("companies", "emailToken", {
        type: Sequelize.STRING,
        allowNull: false
      }),
      queryInterface.addColumn("operators", "emailToken", {
        type: Sequelize.STRING,
        allowNull: false
      }),
    ]);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
