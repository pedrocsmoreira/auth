import jwt from 'jsonwebtoken';
import { respondError } from '../utils/response.js';

export default function jwtAuth(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return respondError(res, 'No token provided', 401);
    }

    const token = authHeader.slice(7);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
