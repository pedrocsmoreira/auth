import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

class Role extends Model {}

Role.init({
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { notEmpty: true }
    }
}, {
    sequelize,
    modelName: 'role'
});

export default Role;
