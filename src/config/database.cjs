// sequelize-cli requires CommonJS config
'use strict';

module.exports = {
    development: {
        dialect: 'sqlite',
        storage: process.env.DATABASE_PATH || './dev.sqlite'
    },
    production: {
        dialect: 'sqlite',
        storage: process.env.DATABASE_PATH
    }
};
