import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        }
    });
});

export default router;
