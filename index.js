import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { sequelize } from './src/models/index.js';
import userRouter from './src/routes/user.js';
import loginRouter from './src/routes/login.js';
import healthRouter from './src/routes/health.js';
import validateApiKey from './src/middleware/validateApiKey.js';
import { respondError } from './src/utils/response.js';
import logger from './src/utils/logger.js';
import { cleanupExpiredTokens } from './src/jobs/cleanupTokens.js';

const server = express();

// CORS — restrict to allowed origins defined in env
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [];

server.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. curl, Postman, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
}));

server.use(pinoHttp({ logger }));
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

// Health check is public — must be mounted before validateApiKey
server.use('/health', healthRouter);

server.use(validateApiKey);

server.use('/user', userRouter);
server.use('/login', loginRouter);

// Global error handler
server.use((err, req, res, _next) => {
    logger.error(err);
    return respondError(res, err.message || 'Internal server error', 500);
});

const PORT = process.env.PORT || 3000;

sequelize.sync()
    .then(() => {
        logger.info('DB is ready');
        server.listen(PORT, () => {
            logger.info(`AUTH API running on port ${PORT}`);
        });

        // Purge expired refresh tokens every hour
        setInterval(cleanupExpiredTokens, 60 * 60 * 1000);
    })
    .catch(err => {
        logger.error({ err }, 'Failed to sync DB');
        process.exit(1);
    });
