import { z } from 'zod';
import { respondError } from '../utils/response.js';

/**
 * Middleware factory — validates req.body against a Zod schema.
 * Returns 400 with field-level error details on failure.
 *
 * Usage: router.post('/', validate(mySchema), handler)
 */
export function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            return respondError(res, errors);
        }
        req.body = result.data; // use coerced/trimmed values
        next();
    };
}

// ─── Shared field definitions ────────────────────────────────────────────────

const username = z.string().trim().min(3).max(64);
const password = z.string().min(8).max(128);

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
    username,
    password
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: password
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1),
    newPassword: password
});

export const forgotPasswordSchema = z.object({
    username
});

export const createUserSchema = z.object({
    username,
    roleId: z.number().int().positive().nullable().optional()
});

export const updateUserSchema = z.object({
    username: username.optional(),
    password: password.optional(),
    roleId: z.number().int().positive().nullable().optional(),
    force_password_change: z.boolean().optional()
}).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided'
});
