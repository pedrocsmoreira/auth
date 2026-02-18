import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, Role, RefreshToken } from '../models/index.js';
import { hashPassword, comparePassword } from '../middleware/hash.js';
import jwtAuth from '../middleware/jwtAuth.js';
import { respond, respondError } from '../utils/response.js';

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

async function generateRefreshToken(userId) {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await RefreshToken.create({ token, userId, expiresAt });
    return token;
}

// POST /login — Authenticate with username + password
router.post('/', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return respondError(res, 'Username and password are required');
        }

        const user = await User.scope('withPassword').findOne({
            where: { username },
            include: [{ model: Role, as: 'role', attributes: ['name'] }]
        });

        if (!user) {
            return respondError(res, 'Invalid credentials', 401);
        }

        const valid = await comparePassword(password, user.password);
        if (!valid) {
            return respondError(res, 'Invalid credentials', 401);
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = await generateRefreshToken(user.id);

        return respond(res, { accessToken, refreshToken });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// POST /login/refresh — Exchange a refresh token for a new access token
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

        const accessToken = generateAccessToken(user);
        return respond(res, { accessToken });
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

        return respond(res, { message: 'Logged out successfully' });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// POST /login/change-password — Change password while authenticated
router.post('/change-password', jwtAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return respondError(res, 'currentPassword and newPassword are required');
        }

        const user = await User.scope('withPassword').findByPk(req.user.userId);
        if (!user) {
            return respondError(res, 'User not found', 404);
        }

        const valid = await comparePassword(currentPassword, user.password);
        if (!valid) {
            return respondError(res, 'Current password is incorrect', 401);
        }

        user.password = await hashPassword(newPassword);
        user.password_change = true;
        user.force_password_change = false;
        await user.save();

        return respond(res, { message: 'Password updated successfully' });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// POST /login/forgot-password — Request a password reset token
router.post('/forgot-password', async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return respondError(res, 'Username is required');
        }

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
        console.log(`[PASSWORD RESET] Token for "${username}": ${resetToken}`);

        return respond(res, { message: genericMsg });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// POST /login/reset-password — Reset password using a reset token
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return respondError(res, 'token and newPassword are required');
        }

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

        return respond(res, { message: 'Password has been reset successfully' });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

export default router;
