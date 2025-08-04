const express = require('express');
const router = express.Router();

const User = require('../models/user');

const hash = require('../middleware/hash');

router.get('/', async (req,res) => {
    const users = await User.findAll();

    if (!users || users.length === 0) {
        return res.status(404).send('No users found');
    }

    res.send(users);
});

router.get('/:id', async (req,res) => {
    const userId = req.params.id;

    if (!userId) {
        return res.status(400).send('User ID is required');
    }

    const user = await User.findOne({ where: {id: userId}});

    if (!user) {
        return res.status(404).send('User not found');
    }

    res.send(user);
});

router.post('/', async (req, res) => {
    const user = await User.create(req.body);

    user.username = req.body.username;
    user.password = hash(req.body.password);

    await user.save();

    res.send('User is inserted');
});

router.put('/:id', async (req, res) => {
    const userId = req.params.id;

    if (!userId) {
        return res.status(400).send('User ID is required');
    }

    const user = await User.findOne({ where: {id: userId}});

    if (!user) {
        return res.status(404).send('User not found');
    }
    
    user.username = req.body.username;
    user.password = req.body.password;

    await user.save();

    res.send(user);
});

router.delete('/:id', async (req,res) => {
    const userId = req.params.id;

    if (!userId) {
        return res.status(400).send('User ID is required');
    }

    const user = await User.findOne({ where: {id: userId}});

    if (!user) {
        return res.status(404).send('User not found');
    }

    await User.destroy({ where: {id: userId}});

    res.send('User removed');
});

module.exports = router;
