import { Op } from 'sequelize';
import { RefreshToken } from '../models/index.js';
import logger from '../utils/logger.js';

export async function cleanupExpiredTokens() {
    const deleted = await RefreshToken.destroy({
        where: { expiresAt: { [Op.lt]: new Date() } }
    });
    if (deleted > 0) {
        logger.info({ action: 'cleanup.refreshTokens', count: deleted }, `Purged ${deleted} expired refresh token(s)`);
    }
}
