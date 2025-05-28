module.exports = (sequelize, Sequelize) => {
  const Company = sequelize.define("company", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    email: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false,
    },
    password: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    emailToken: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    verified: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "false",
    },
    is_Active: {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    total_drivers: {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    inactive_drivers: {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    rating: {
      type: Sequelize.FLOAT,
      allowNull: true,
      defaultValue: null,
    },
    hourly_rate: {
      type: Sequelize.DOUBLE,
      allowNull: true,
      defaultValue: null,
    },
    total_drives: {
      type: Sequelize.BIGINT,
      allowNull: true,
      defaultValue: null,
    },
    description: {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    },
    profileUrl: {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    },
    contact: {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    },
    address: {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    },
  });
  return Company;
};
