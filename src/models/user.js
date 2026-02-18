import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

class User extends Model {}

User.init({
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { notEmpty: true }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    roleId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    password_change: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    force_password_change: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    reset_token: {
        type: DataTypes.STRING,
        allowNull: true
    },
    reset_token_expires: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'user',
    scopes: {
        // Use this scope for queries that need to verify passwords
        withPassword: {},
        // Use this scope for password-reset flows (also exposes reset token fields)
        withResetToken: {},
        // Default safe view — exclude sensitive fields
        safe: {
            attributes: { exclude: ['password', 'reset_token', 'reset_token_expires'] }
        }
    }
});

export default User;
