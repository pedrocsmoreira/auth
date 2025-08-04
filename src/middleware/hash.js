const crypto = require('crypto');

export default async (data) => {
    const hash = crypto.createHash('sha512').update(data).digest('hex');;
    return hash;    
};
