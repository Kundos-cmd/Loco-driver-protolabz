module.exports = (sequelize, Sequelize) => {
  const Admin = sequelize.define("admin", {
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
    role: {
      type: Sequelize.ENUM("super", "sub"),
      allowNull: false,
    },
    is_deleted: {
      type: Sequelize.BOOLEAN,
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
  return Admin;
};
