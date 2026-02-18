import { Sequelize } from 'sequelize';

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DATABASE_PATH || './dev.sqlite',
    logging: process.env.NODE_ENV === 'development' ? console.log : false
});

export default sequelize;
