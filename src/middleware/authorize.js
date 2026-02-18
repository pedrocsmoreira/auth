import { respondError } from '../utils/response.js';

/**
 * Middleware factory — restricts access to users with one of the given roles.
 * Roles are embedded as strings in the JWT payload (e.g. 'admin', 'user').
 *
 * Usage: router.delete('/:id', authorize('admin'), handler)
 */
export default function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return respondError(res, 'Not authenticated', 401);
        }
        if (!allowedRoles.includes(req.user.role)) {
            return respondError(res, 'Forbidden: insufficient permissions', 403);
        }
        next();
    };
}
