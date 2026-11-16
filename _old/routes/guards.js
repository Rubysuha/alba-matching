// 권한 검사 미들웨어
// 예: router.patch('/:id/accept', isLoggedIn, isApplicationJobOwner, accept)
const { Job, Resume, Application, Review } = require('../models');
const { HttpError, fail, wrap, positiveInt } = require('./api-utils');

const paramId = req => {
    const id = positiveInt(req.params.id);
    if (id === null) throw new HttpError(400, 'id가 올바르지 않습니다.');
    return id;
};

// 로그인 필요 (401)
exports.isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) next();
    else fail(res, 401, '로그인이 필요합니다.');
};

// 공고 작성자만 → req.job
exports.isJobOwner = wrap(async (req, res, next) => {
    const job = await Job.findByPk(paramId(req));
    if (!job) throw new HttpError(404, '공고를 찾을 수 없습니다.');
    if (job.ownerId !== req.user.id) throw new HttpError(403, '공고 작성자만 할 수 있습니다.');
    req.job = job;
    next();
});

// 이력서 작성자만 → req.resumeDoc
exports.isResumeOwner = wrap(async (req, res, next) => {
    const resume = await Resume.findByPk(paramId(req));
    if (!resume) throw new HttpError(404, '이력서를 찾을 수 없습니다.');
    if (resume.userId !== req.user.id) throw new HttpError(403, '이력서 작성자만 할 수 있습니다.');
    req.resumeDoc = resume;
    next();
});

// 이력서 열람: 본인, 또는 이 이력서로 지원받은 공고의 사장님 → req.resumeDoc
exports.canViewResume = wrap(async (req, res, next) => {
    const resume = await Resume.findByPk(paramId(req));
    if (!resume) throw new HttpError(404, '이력서를 찾을 수 없습니다.');

    if (resume.userId !== req.user.id) {
        const received = await Application.findOne({
            where: { resumeId: resume.id },
            include: [{ model: Job, where: { ownerId: req.user.id }, required: true, attributes: ['id'] }]
        });
        if (!received) throw new HttpError(403, '열람 권한이 없습니다.');
    }
    req.resumeDoc = resume;
    next();
});

// 지원이 걸린 공고의 작성자만 → req.application (Job 포함)
exports.isApplicationJobOwner = wrap(async (req, res, next) => {
    const application = await Application.findByPk(paramId(req), { include: [Job] });
    if (!application) throw new HttpError(404, '지원을 찾을 수 없습니다.');
    if (!application.Job || application.Job.ownerId !== req.user.id)
        throw new HttpError(403, '공고 작성자만 할 수 있습니다.');
    req.application = application;
    next();
});

// 후기 작성자만 → req.review
exports.isReviewAuthor = wrap(async (req, res, next) => {
    const review = await Review.findByPk(paramId(req));
    if (!review) throw new HttpError(404, '후기를 찾을 수 없습니다.');
    if (review.authorId !== req.user.id) throw new HttpError(403, '후기 작성자만 할 수 있습니다.');
    req.review = review;
    next();
});

exports.paramId = paramId;
