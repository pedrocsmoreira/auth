import logger from './logger.js';

/**
 * Write a structured audit log entry.
 *
 * @param {string} action  - e.g. 'login.success', 'user.created'
 * @param {object} meta    - arbitrary key/value context (userId, username, ip, etc.)
 */
export function audit(action, meta = {}) {
    logger.info({ audit: true, action, ...meta });
}
