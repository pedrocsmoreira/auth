import sequelize from '../sequelize.js';
import User from './user.js';
import Role from './role.js';
import RefreshToken from './refreshToken.js';

// Associations
Role.hasMany(User, { foreignKey: 'roleId' });
User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

User.hasMany(RefreshToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'userId' });

export { sequelize, User, Role, RefreshToken };
