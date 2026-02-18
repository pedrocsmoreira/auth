import rateLimit from 'express-rate-limit';
import { respondError } from '../utils/response.js';

/**
 * Strict rate limiter for the login endpoint.
 * 10 attempts per 15 minutes per IP.
 */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        return respondError(res, 'Too many login attempts. Please try again in 15 minutes.', 429);
    }
});
