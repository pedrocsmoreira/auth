export default function validateApiKey(req, res, next) {
    const LOGIN_API_KEY = process.env.LOGIN_API_KEY;
    const MASTER_API_KEY = process.env.MASTER_API_KEY;

    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(403).json({ success: false, error: 'API key not provided' });
    }

    if (apiKey === MASTER_API_KEY) {
        req.apiKeyRole = 'master';
        return next();
    }

    if (apiKey === LOGIN_API_KEY) {
        req.apiKeyRole = 'login';
        return next();
    }

    return res.status(403).json({ success: false, error: 'Invalid API key' });
}
