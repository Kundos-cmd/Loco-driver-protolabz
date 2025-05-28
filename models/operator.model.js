module.exports = (sequelize, Sequelize) => {
  const Operator = sequelize.define("operator", {
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
    verfied: {
      type: Sequelize.STRING,
      isIn: [["true", "false"]],
      allowNull: false,
      defaultValue: "false",
    },
    is_Active: {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    is_Active: {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    rating: {
      type: Sequelize.FLOAT,
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
  return Operator;
};
