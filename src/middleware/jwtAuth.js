import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { respondError } from '../utils/response.js';

export default async function jwtAuth(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return respondError(res, 'No token provided', 401);
    }

    const token = authHeader.slice(7);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check deactivation on every request — catches accounts deactivated after token issuance
        const user = await User.findByPk(decoded.userId, {
            attributes: ['id', 'deactivated_at']
        });

        if (!user) {
            return respondError(res, 'User no longer exists', 401);
        }

        if (user.deactivated_at) {
            return respondError(res, 'Account is deactivated', 403);
        }

        req.user = decoded; // { userId, username, role, force_password_change }

        // If a password change is required, only allow the change-password endpoint
        if (decoded.force_password_change && !req.path.endsWith('/change-password')) {
            return respondError(res, 'You must change your password before continuing', 403);
        }

        next();
    } catch {
        return respondError(res, 'Invalid or expired token', 401);
    }
}

