const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const router = express.Router();

const sequelize = require('./src/sequelize');
const userRouter = require("./src/routes/user");

const server = express();

server.use(cors());
server.use(bodyParser.urlencoded({ extended: true }));
server.use(bodyParser.json());

sequelize.sync({ force: true }).then(() => {
    console.log('db is ready');
});

require('dotenv').config();

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("AUTH API IS ON in PORT " + PORT);
});

server.use('/user', userRouter);

module.exports = router;
