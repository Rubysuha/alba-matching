const express = require('express');
const { isLoggedIn } = require('../middlewares/auth');
const { isReviewAuthor } = require('../middlewares/owner');
const c = require('../controllers/reviews');

const router = express.Router();

router.post('/', isLoggedIn, c.create);                                         // ★ 후기 작성
router.get('/owners/:ownerId', c.listByOwner);                                  // 사장님별 후기 목록
router.get('/owners/:ownerId/score', c.score);                                  // 평균 평점·후기 수
router.patch('/:id', isLoggedIn, isReviewAuthor, c.update);                     // 후기 수정
router.delete('/:id', isLoggedIn, isReviewAuthor, c.remove);                    // 후기 삭제

module.exports = router;
