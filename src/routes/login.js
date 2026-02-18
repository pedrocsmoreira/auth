import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, Role, RefreshToken } from '../models/index.js';
import { hashPassword, comparePassword } from '../middleware/hash.js';
import jwtAuth from '../middleware/jwtAuth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { validate, loginSchema, changePasswordSchema, resetPasswordSchema, forgotPasswordSchema } from '../middleware/validate.js';
import { respond, respondError } from '../utils/response.js';
import { audit } from '../utils/auditLog.js';

const router = express.Router();

function generateAccessToken(user) {
    return jwt.sign(
        {
            userId: user.id,
            username: user.username,
            role: user.role?.name || 'user',
            force_password_change: user.force_password_change
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );
}

async function issueRefreshToken(userId) {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await RefreshToken.create({ token, userId, expiresAt });
    return token;
}

// POST /login — Authenticate with username + password
router.post('/', loginLimiter, validate(loginSchema), async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.scope('withPassword').findOne({
            where: { username },
            include: [{ model: Role, as: 'role', attributes: ['name'] }]
        });

        if (!user) {
            audit('login.failure', { username, reason: 'user_not_found', ip: req.ip });
            return respondError(res, 'Invalid credentials', 401);
        }

        const valid = await comparePassword(password, user.password);
        if (!valid) {
            audit('login.failure', { username, userId: user.id, reason: 'wrong_password', ip: req.ip });
            return respondError(res, 'Invalid credentials', 401);
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = await issueRefreshToken(user.id);

        audit('login.success', { userId: user.id, username: user.username, ip: req.ip });
        return respond(res, { accessToken, refreshToken });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// POST /login/refresh — Exchange a refresh token for a new access token (token rotation)
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return respondError(res, 'Refresh token required');
        }

        const stored = await RefreshToken.findOne({
            where: { token: refreshToken, revoked: false }
        });

        if (!stored || new Date() > stored.expiresAt) {
            return respondError(res, 'Invalid or expired refresh token', 401);
        }

        const user = await User.scope('withPassword').findOne({
            where: { id: stored.userId },
            include: [{ model: Role, as: 'role', attributes: ['name'] }]
        });

        if (!user) {
            return respondError(res, 'User not found', 404);
        }

        // Rotate: revoke the consumed token and issue a fresh one
        await stored.update({ revoked: true });
        const newRefreshToken = await issueRefreshToken(user.id);

        const accessToken = generateAccessToken(user);
        audit('token.refreshed', { userId: user.id, ip: req.ip });
        return respond(res, { accessToken, refreshToken: newRefreshToken });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// POST /login/logout — Revoke the provided refresh token
router.post('/logout', jwtAuth, async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            await RefreshToken.update(
                { revoked: true },
                { where: { token: refreshToken, userId: req.user.userId } }
            );
        }

        audit('logout', { userId: req.user.userId, ip: req.ip });
        return respond(res, { message: 'Logged out successfully' });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// POST /login/logout-all — Revoke every active session for the authenticated user
router.post('/logout-all', jwtAuth, async (req, res) => {
    try {
        const count = await RefreshToken.update(
            { revoked: true },
            { where: { userId: req.user.userId, revoked: false } }
        );

        audit('logout.all', { userId: req.user.userId, tokensRevoked: count[0], ip: req.ip });
        return respond(res, { message: `All sessions terminated (${count[0]} token(s) revoked)` });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// POST /login/change-password — Change password while authenticated
router.post('/change-password', jwtAuth, validate(changePasswordSchema), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.scope('withPassword').findByPk(req.user.userId);
        if (!user) {
            return respondError(res, 'User not found', 404);
        }

        const valid = await comparePassword(currentPassword, user.password);
        if (!valid) {
            audit('password.change.failure', { userId: req.user.userId, reason: 'wrong_current_password', ip: req.ip });
            return respondError(res, 'Current password is incorrect', 401);
        }

        user.password = await hashPassword(newPassword);
        user.password_change = true;
        user.force_password_change = false;
        await user.save();

        audit('password.changed', { userId: req.user.userId, ip: req.ip });
        return respond(res, { message: 'Password updated successfully' });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// POST /login/forgot-password — Request a password reset token
router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
    try {
        const { username } = req.body;

        const user = await User.scope('withResetToken').findOne({ where: { username } });

        // Always return the same message to avoid user enumeration
        const genericMsg = 'If that username exists, a reset token has been issued.';

        if (!user) {
            return respond(res, { message: genericMsg });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.reset_token = resetToken;
        user.reset_token_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save();

        // In production: send resetToken via email. For now, log it for dev use.
        audit('password.reset.requested', { userId: user.id, ip: req.ip });
        console.log(`[PASSWORD RESET] Token for "${username}": ${resetToken}`);

        return respond(res, { message: genericMsg });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// POST /login/reset-password — Reset password using a reset token
router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const user = await User.scope('withResetToken').findOne({
            where: { reset_token: token }
        });

        if (!user || !user.reset_token_expires || new Date() > user.reset_token_expires) {
            return respondError(res, 'Reset token is invalid or has expired', 400);
        }

        user.password = await hashPassword(newPassword);
        user.reset_token = null;
        user.reset_token_expires = null;
        user.force_password_change = false;
        user.password_change = true;
        await user.save();

        audit('password.reset.completed', { userId: user.id, ip: req.ip });
        return respond(res, { message: 'Password has been reset successfully' });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

export default router;
