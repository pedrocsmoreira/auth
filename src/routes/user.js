import express from 'express';
import crypto from 'crypto';
import { User } from '../models/index.js';
import { hashPassword } from '../middleware/hash.js';
import jwtAuth from '../middleware/jwtAuth.js';
import authorize from '../middleware/authorize.js';
import requireMasterKey from '../middleware/requireMasterKey.js';
import { validate, createUserSchema, updateUserSchema } from '../middleware/validate.js';
import { respond, respondError } from '../utils/response.js';
import { audit } from '../utils/auditLog.js';

const router = express.Router();

// All user routes require a valid JWT
router.use(jwtAuth);

// GET /user/ — List all users with pagination (admin only)
router.get('/', authorize('admin'), async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const offset = (page - 1) * limit;

        const { count, rows } = await User.scope('safe').findAndCountAll({ limit, offset, order: [['id', 'ASC']] });

        return respond(res, { users: rows, total: count, page, limit, pages: Math.ceil(count / limit) });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// GET /user/:id — Get a single user
router.get('/:id', async (req, res) => {
    try {
        const user = await User.scope('safe').findByPk(req.params.id);
        if (!user) return respondError(res, 'User not found', 404);
        return respond(res, user);
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// POST /user/ — Create a new user (admin only, master API key only)
// The admin never sets or sees the password. An invite token is returned instead;
// the new user calls POST /login/reset-password to activate their account.
router.post('/', requireMasterKey, authorize('admin'), validate(createUserSchema), async (req, res) => {
    try {
        const { username, roleId } = req.body;

        // Generate an internal temp password — never exposed to the caller
        const tempPassword = crypto.randomBytes(32).toString('hex');
        const hashedPassword = await hashPassword(tempPassword);

        // Invite token gives the user 48 h to set their own password
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

        const created = await User.create({
            username,
            password: hashedPassword,
            roleId: roleId || null,
            force_password_change: true,
            reset_token: inviteToken,
            reset_token_expires: inviteExpires
        });

        const safeUser = await User.scope('safe').findByPk(created.id);
        audit('user.created', { createdBy: req.user.userId, newUserId: created.id, username, ip: req.ip });
        return respond(res, { ...safeUser.toJSON(), inviteToken }, 201);
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return respondError(res, 'Username already exists', 409);
        }
        return respondError(res, err.message, 500);
    }
});

// PUT /user/:id — Update a user (admin can update anyone; users can update themselves)
router.put('/:id', validate(updateUserSchema), async (req, res) => {
    try {
        const user = await User.scope('withPassword').findByPk(req.params.id);
        if (!user) return respondError(res, 'User not found', 404);

        // Only admin or the authenticated user themselves may update
        if (req.user.role !== 'admin' && req.user.userId !== user.id) {
            audit('permission.denied', { userId: req.user.userId, action: 'user.update', targetId: user.id, ip: req.ip });
            return respondError(res, 'Forbidden', 403);
        }

        if (req.body.username) user.username = req.body.username;
        if (req.body.password) user.password = await hashPassword(req.body.password);

        // Only admins may change roles or force_password_change
        if (req.user.role === 'admin') {
            if (req.body.roleId !== undefined) user.roleId = req.body.roleId;
            if (req.body.force_password_change !== undefined) {
                user.force_password_change = req.body.force_password_change;
            }
        }

        await user.save();

        const safeUser = await User.scope('safe').findByPk(user.id);
        return respond(res, safeUser);
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return respondError(res, 'Username already exists', 409);
        }
        return respondError(res, err.message, 500);
    }
});

// DELETE /user/:id — Delete a user (admin only, master API key only)
router.delete('/:id', requireMasterKey, authorize('admin'), async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return respondError(res, 'User not found', 404);

        // Prevent an admin from deleting their own account
        if (req.user.userId === user.id) {
            return respondError(res, 'Cannot delete your own account', 400);
        }

        await user.destroy();
        audit('user.deleted', { deletedBy: req.user.userId, deletedUserId: user.id, username: user.username, ip: req.ip });
        return respond(res, { message: 'User deleted' });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// POST /user/:id/deactivate — Soft-deactivate a user (admin only, master API key only)
router.post('/:id/deactivate', requireMasterKey, authorize('admin'), async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return respondError(res, 'User not found', 404);

        if (req.user.userId === user.id) {
            return respondError(res, 'Cannot deactivate your own account', 400);
        }

        if (user.deactivated_at) {
            return respondError(res, 'Account is already deactivated', 409);
        }

        user.deactivated_at = new Date();
        await user.save();

        audit('user.deactivated', { deactivatedBy: req.user.userId, targetUserId: user.id, username: user.username, ip: req.ip });
        return respond(res, { message: `User "${user.username}" has been deactivated` });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// POST /user/:id/reactivate — Re-activate a deactivated user (admin only, master API key only)
router.post('/:id/reactivate', requireMasterKey, authorize('admin'), async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return respondError(res, 'User not found', 404);

        if (!user.deactivated_at) {
            return respondError(res, 'Account is not deactivated', 409);
        }

        user.deactivated_at = null;
        await user.save();

        audit('user.reactivated', { reactivatedBy: req.user.userId, targetUserId: user.id, username: user.username, ip: req.ip });
        return respond(res, { message: `User "${user.username}" has been reactivated` });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

export default router;

