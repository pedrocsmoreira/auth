import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

class RefreshToken extends Model {}

RefreshToken.init({
    token: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    revoked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    sequelize,
    modelName: 'refreshToken'
});

export default RefreshToken;
