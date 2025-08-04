const express = require('express');
const router = express.Router();

const User = require('../models/user');

const hash = require('../middleware/hash');

router.get('/', async (req,res) => {
    const users = await User.findAll();
    res.send(users);
});

router.get('/:id', async (req,res) => {
    const userId = req.params.id;
    const user = await User.findOne({ where: {id: userId}});
    res.send(user);
});

router.post('/', async (req, res) => {
    const user = await User.create(req.body);
    user.username = req.body.username;
    user.password = hash(req.body.password);
    await user.save;
    res.send('user is inserted');
});

router.put('/:id', async (req, res) => {
    const userId = req.params.id;
    const user = await User.findOne({ where: {id: userId}});
    user.username = req.body.username;
    user.password = req.body.password;
    res.send(user);
});

router.delete('/:id', async (req,res) => {
    const userId = req.params.id;
    await User.destroy({ where: {id: userId}});
    res.send('user removed');
});

module.exports = router;
