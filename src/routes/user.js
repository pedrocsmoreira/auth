import express from 'express';
import { User } from '../models/index.js';
import { hashPassword } from '../middleware/hash.js';
import jwtAuth from '../middleware/jwtAuth.js';
import authorize from '../middleware/authorize.js';
import { respond, respondError } from '../utils/response.js';

const router = express.Router();

// All user routes require a valid JWT
router.use(jwtAuth);

// GET /user/ — List all users (admin only)
router.get('/', authorize('admin'), async (req, res) => {
    try {
        const users = await User.scope('safe').findAll();
        return respond(res, users);
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

// POST /user/ — Create a new user (admin only)
router.post('/', authorize('admin'), async (req, res) => {
    try {
        const { username, password, roleId, force_password_change } = req.body;

        if (!username || !password) {
            return respondError(res, 'username and password are required');
        }

        const hashedPassword = await hashPassword(password);
        const created = await User.create({
            username,
            password: hashedPassword,
            roleId: roleId || null,
            force_password_change: force_password_change || false
        });

        const safeUser = await User.scope('safe').findByPk(created.id);
        return respond(res, safeUser, 201);
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return respondError(res, 'Username already exists', 409);
        }
        return respondError(res, err.message, 500);
    }
});

// PUT /user/:id — Update a user (admin can update anyone; users can update themselves)
router.put('/:id', async (req, res) => {
    try {
        const user = await User.scope('withPassword').findByPk(req.params.id);
        if (!user) return respondError(res, 'User not found', 404);

        // Only admin or the authenticated user themselves may update
        if (req.user.role !== 'admin' && req.user.userId !== user.id) {
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

// DELETE /user/:id — Delete a user (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return respondError(res, 'User not found', 404);

        await user.destroy();
        return respond(res, { message: 'User deleted' });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

export default router;

router.get('/', async (req,res) => {
    const users = await User.findAll();

    if (!users || users.length === 0) {
        return res.status(404).send('No users found');
    }

    res.send(users);
});

router.get('/:id', async (req,res) => {
    const userId = req.params.id;

    if (!userId) {
        return res.status(400).send('User ID is required');
    }

    const user = await User.findOne({ where: {id: userId}});

    if (!user) {
        return res.status(404).send('User not found');
    }

    res.send(user);
});

router.post('/', async (req, res) => {
    const user = await User.create(req.body);

    user.username = req.body.username;
    user.password = hash(req.body.password);

    await user.save();

    res.send('User is inserted');
});

router.put('/:id', async (req, res) => {
    const userId = req.params.id;

    if (!userId) {
        return res.status(400).send('User ID is required');
    }

    const user = await User.findOne({ where: {id: userId}});

    if (!user) {
        return res.status(404).send('User not found');
    }
    
    user.username = req.body.username;
    user.password = req.body.password;

    await user.save();

    res.send(user);
});

router.delete('/:id', async (req,res) => {
    const userId = req.params.id;

    if (!userId) {
        return res.status(400).send('User ID is required');
    }

    const user = await User.findOne({ where: {id: userId}});

    if (!user) {
        return res.status(404).send('User not found');
    }

    await User.destroy({ where: {id: userId}});

    res.send('User removed');
});

module.exports = router;
