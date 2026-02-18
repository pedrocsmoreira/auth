'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('roles', {
            id:        { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
            name:      { type: Sequelize.STRING, allowNull: false, unique: true },
            createdAt: { type: Sequelize.DATE, allowNull: false },
            updatedAt: { type: Sequelize.DATE, allowNull: false }
        });

        await queryInterface.createTable('users', {
            id:                   { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
            username:             { type: Sequelize.STRING, allowNull: false, unique: true },
            password:             { type: Sequelize.STRING, allowNull: false },
            roleId:               { type: Sequelize.INTEGER, references: { model: 'roles', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
            password_change:      { type: Sequelize.BOOLEAN, defaultValue: false },
            force_password_change:{ type: Sequelize.BOOLEAN, defaultValue: false },
            deactivated_at:       { type: Sequelize.DATE, allowNull: true },
            reset_token:          { type: Sequelize.STRING, allowNull: true },
            reset_token_expires:  { type: Sequelize.DATE, allowNull: true },
            createdAt:            { type: Sequelize.DATE, allowNull: false },
            updatedAt:            { type: Sequelize.DATE, allowNull: false }
        });

        await queryInterface.createTable('refreshTokens', {
            id:        { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
            token:     { type: Sequelize.STRING, allowNull: false, unique: true },
            userId:    { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
            expiresAt: { type: Sequelize.DATE, allowNull: false },
            revoked:   { type: Sequelize.BOOLEAN, defaultValue: false },
            createdAt: { type: Sequelize.DATE, allowNull: false },
            updatedAt: { type: Sequelize.DATE, allowNull: false }
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('refreshTokens');
        await queryInterface.dropTable('users');
        await queryInterface.dropTable('roles');
    }
};
