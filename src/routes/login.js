const express = require('express');
const router = express.Router();

const User = require('../models/user');

const hash = require('../middleware/hash');

router.get('/:id', async (req,res) => {
    const userId = req.params.id;

    const user = await User.findOne({ where: {id: userId}});

    if (!user) {
        return res.status(404).send({ error: 'User not found' });
    }

    if (req.body.password) {
        password = hash(req.body.password);
    }else {
        return res.status(400).send({ error: 'Password is required' });
    }

    if (user.password != password) {
        return res.status(401).send({ error: 'Invalid password' });
    }

    res.send(user);
});

router.put('/:id', async (req, res) => {
    const userId = req.params.id;
    
    const user = await User.findOne({ where: {id: userId}});

    user.password = req.body.password;
    
    res.send(user);
});

module.exports = router;
