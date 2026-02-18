import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { sequelize } from './src/models/index.js';
import userRouter from './src/routes/user.js';
import loginRouter from './src/routes/login.js';
import validateApiKey from './src/middleware/validateApiKey.js';
import { respondError } from './src/utils/response.js';

const server = express();

server.use(cors());
server.use(morgan('dev'));
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

server.use(validateApiKey);

server.use('/user', userRouter);
server.use('/login', loginRouter);

// Global error handler
server.use((err, req, res, _next) => {
    console.error(err);
    return respondError(res, err.message || 'Internal server error', 500);
});

const PORT = process.env.PORT || 3000;

sequelize.sync({ alter: true })
    .then(() => {
        console.log('DB is ready');
        server.listen(PORT, () => {
            console.log(`AUTH API running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Failed to sync DB:', err);
        process.exit(1);
    });
