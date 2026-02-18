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
    deactivated_at: {
        type: DataTypes.DATE,
        allowNull: true
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
        // Explicitly include password for auth checks
        withPassword: {
            attributes: { include: ['password'] }
        },
        // Explicitly include reset token fields for password-reset flows
        withResetToken: {
            attributes: { include: ['reset_token', 'reset_token_expires'] }
        },
        // Default safe view — exclude all sensitive fields
        safe: {
            attributes: { exclude: ['password', 'reset_token', 'reset_token_expires'] }
        }
    }
});

export default User;
