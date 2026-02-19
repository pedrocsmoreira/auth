import express from 'express';
import { Role } from '../models/index.js';
import requireMasterKey from '../middleware/requireMasterKey.js';
import { validate, createRoleSchema } from '../middleware/validate.js';
import { respond, respondError } from '../utils/response.js';
import { audit } from '../utils/auditLog.js';

const router = express.Router();

// GET /roles — List all roles (login key or master key)
router.get('/', async (req, res) => {
    try {
        const roles = await Role.findAll({ order: [['id', 'ASC']] });
        return respond(res, roles);
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// GET /roles/:id — Get a single role (login key or master key)
router.get('/:id', async (req, res) => {
    try {
        const role = await Role.findByPk(req.params.id);
        if (!role) return respondError(res, 'Role not found', 404);
        return respond(res, role);
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

// POST /roles — Create a role (master key only)
router.post('/', requireMasterKey, validate(createRoleSchema), async (req, res) => {
    try {
        const { name } = req.body;
        const role = await Role.create({ name });
        audit('role.created', { name, roleId: role.id });
        return respond(res, role, 201);
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return respondError(res, 'Role already exists', 409);
        }
        return respondError(res, err.message, 500);
    }
});

// DELETE /roles/:id — Delete a role (master key only)
router.delete('/:id', requireMasterKey, async (req, res) => {
    try {
        const role = await Role.findByPk(req.params.id);
        if (!role) return respondError(res, 'Role not found', 404);
        await role.destroy();
        audit('role.deleted', { roleId: role.id, name: role.name });
        return respond(res, { message: 'Role deleted' });
    } catch (err) {
        return respondError(res, err.message, 500);
    }
});

export default router;
