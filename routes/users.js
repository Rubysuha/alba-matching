const express = require('express');
const { isLoggedIn, isNotLoggedIn } = require('../middlewares/auth');
const c = require('../controllers/users');

const router = express.Router();

router.post('/join', isNotLoggedIn, c.join);
router.post('/login', isNotLoggedIn, c.login);
router.post('/logout', isLoggedIn, c.logout);
router.get('/me', isLoggedIn, c.me);

module.exports = router;
