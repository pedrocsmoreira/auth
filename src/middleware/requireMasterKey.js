import { respondError } from '../utils/response.js';

/**
 * Requires the request to have been authenticated with the MASTER_API_KEY.
 * Apply this to any route that should be inaccessible to apps using LOGIN_API_KEY.
 *
 * Must come after validateApiKey middleware in the stack.
 */
export default function requireMasterKey(req, res, next) {
    if (req.apiKeyRole !== 'master') {
        return respondError(res, 'This operation requires a master API key', 403);
    }
    next();
}
