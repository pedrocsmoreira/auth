const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize.js');

class User extends Model {};

User.init({
    username: {
        type: DataTypes.STRING
    },
    password: {
        type: DataTypes.STRING
    },
    password_change: {
        type: DataTypes.BOOLEAN
    },
    force_password_change: {
        type: DataTypes.BOOLEAN
    }
}, {
    sequelize,
    modelName: 'user'
});

module.exports = User;
