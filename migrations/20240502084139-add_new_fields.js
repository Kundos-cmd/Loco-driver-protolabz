"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn("admins", "verfied", {
        type: Sequelize.STRING,
        isIn: [["true", "false"]],
        allowNull: false,
        defaultValue: "false",
      }),
      queryInterface.addColumn("companies", "verfied", {
        type: Sequelize.STRING,
        isIn: [["true", "false"]],
        allowNull: false,
        defaultValue: "false",
      }),
      queryInterface.addColumn("operators", "verfied", {
        type: Sequelize.STRING,
        isIn: [["true", "false"]],
        allowNull: false,
        defaultValue: "false",
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
