require('dotenv').config();

const LOGIN_API_KEY = process.env.LOGIN_API_KEY;
const MASTER_API_KEY = process.env.MASTER_API_KEY;

export default async (req, res, next) => {
    let apiKey = req.headers['X-API-KEY'] || req.headers['x-api-key'];

    if(!apiKey) {
        res.status(403);
        return res.send({ error: 'API KEY NOT PROVIDED'});
    }

    if(apiKey === LOGIN_API_KEY) {
        //validate host
    }

    if(apiKey === MASTER_API_KEY) {
        //validate host
    }

    res.status(403);
    return res.send({ error: 'API KEY HAS NO MATCH'});
};
