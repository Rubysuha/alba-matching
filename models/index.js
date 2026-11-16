const Sequelize = require('sequelize');
const User = require('./user');
const Job = require('./job');
const Resume = require('./resume');
const Application = require('./application');
const Review = require('./review');
const Shift = require('./shift');
const Payroll = require('./payroll');
const Notification = require('./notification');

const env = process.env.NODE_ENV || 'development';
const config = require('../config/config.json')[env];

const sequelize = new Sequelize(
    config.database, config.username, config.password, config
);

const db = { sequelize, User, Job, Resume, Application, Review, Shift, Payroll, Notification };

User.init(sequelize);
Job.init(sequelize);
Resume.init(sequelize);
Application.init(sequelize);
Review.init(sequelize);
Shift.init(sequelize);
Payroll.init(sequelize);
Notification.init(sequelize);

User.associate(db);
Job.associate(db);
Resume.associate(db);
Application.associate(db);
Review.associate(db);
Shift.associate(db);
Payroll.associate(db);
Notification.associate(db);

module.exports = db;
