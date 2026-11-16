// 리소스 주인 검사
// 공통 패턴: 대상 찾기 → 없으면 404 → 남의 것이면 403 → 찾은 데이터를 req 에 싣고 next()
// 컨트롤러는 같은 데이터를 다시 조회하지 않는다
// (이력서는 req.resume 이 Node 내장 메서드 IncomingMessage.resume() 과 이름이 겹쳐 req.resumeDoc 에 싣는다)
const { Job, Resume, Application, Review, Shift, Payroll, Notification } = require('../models');
const { HttpError } = require('../utils/response');
const { positiveInt } = require('../utils/validate');

const idOf = req => {
    const id = positiveInt(req.params.id);
    if (id === null) throw new HttpError(400, 'id가 올바르지 않습니다.');
    return id;
};

// 공고 작성자 → req.job   (PATCH·DELETE /jobs/:id, PATCH /jobs/:id/status)
exports.isJobOwner = async (req, res, next) => {
    try {
        const job = await Job.findByPk(idOf(req));
        if (!job) throw new HttpError(404, '공고를 찾을 수 없습니다.');
        if (job.ownerId !== req.user.id) throw new HttpError(403, '공고 작성자만 할 수 있습니다.');
        req.job = job;
        next();
    } catch (err) { next(err); }
};

// 이력서 작성자 → req.resumeDoc   (PATCH·DELETE /resumes/:id)
exports.isResumeOwner = async (req, res, next) => {
    try {
        const resume = await Resume.findByPk(idOf(req));
        if (!resume) throw new HttpError(404, '이력서를 찾을 수 없습니다.');
        if (resume.userId !== req.user.id) throw new HttpError(403, '이력서 작성자만 할 수 있습니다.');
        req.resumeDoc = resume;
        next();
    } catch (err) { next(err); }
};

// 본인이거나, 이 이력서로 지원받은 공고의 주인 → req.resumeDoc   (GET /resumes/:id, /resumes/:id/careers)
exports.canViewResume = async (req, res, next) => {
    try {
        const resume = await Resume.findByPk(idOf(req));
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
    } catch (err) { next(err); }
};

// 지원한 공고의 주인 → req.application (Job 포함)   (accept · reject · complete)
// /jobs/:id 용 isJobOwner 는 공고 id 로, 여기는 지원 id 로 찾기 때문에 이름을 분리했다
exports.isJobOwnerOfApplication = async (req, res, next) => {
    try {
        const application = await Application.findByPk(idOf(req), { include: [Job] });
        if (!application) throw new HttpError(404, '지원을 찾을 수 없습니다.');
        if (!application.Job || application.Job.ownerId !== req.user.id)
            throw new HttpError(403, '공고 작성자만 할 수 있습니다.');
        req.application = application;
        next();
    } catch (err) { next(err); }
};

// 후기 작성자 → req.review   (PATCH·DELETE /reviews/:id)
exports.isReviewAuthor = async (req, res, next) => {
    try {
        const review = await Review.findByPk(idOf(req));
        if (!review) throw new HttpError(404, '후기를 찾을 수 없습니다.');
        if (review.authorId !== req.user.id) throw new HttpError(403, '후기 작성자만 할 수 있습니다.');
        req.review = review;
        next();
    } catch (err) { next(err); }
};

// ---------- 근무 기록 · 정산 · 알림 ----------

const shiftInclude = [{ model: Application, include: [Job] }];

// 일정의 지원자 === 나 → req.shift   (check-in · check-out)
exports.isShiftWorker = async (req, res, next) => {
    try {
        const shift = await Shift.findByPk(idOf(req), { include: shiftInclude });
        if (!shift) throw new HttpError(404, '근무 일정을 찾을 수 없습니다.');
        if (shift.Application.applicantId !== req.user.id)
            throw new HttpError(403, '본인의 근무 일정만 처리할 수 있습니다.');
        req.shift = shift;
        next();
    } catch (err) { next(err); }
};

// 일정이 속한 공고의 주인 === 나 → req.shift   (confirm · no-show)
exports.isShiftJobOwner = async (req, res, next) => {
    try {
        const shift = await Shift.findByPk(idOf(req), { include: shiftInclude });
        if (!shift) throw new HttpError(404, '근무 일정을 찾을 수 없습니다.');
        if (shift.Application.Job.ownerId !== req.user.id)
            throw new HttpError(403, '공고 작성자만 할 수 있습니다.');
        req.shift = shift;
        next();
    } catch (err) { next(err); }
};

// 발행한 사장님 또는 받는 알바생 → req.payroll   (GET /payrolls/:id)
exports.canViewPayroll = async (req, res, next) => {
    try {
        const payroll = await Payroll.findByPk(idOf(req));
        if (!payroll) throw new HttpError(404, '정산서를 찾을 수 없습니다.');
        if (payroll.ownerId !== req.user.id && payroll.workerId !== req.user.id)
            throw new HttpError(403, '열람 권한이 없습니다.');
        req.payroll = payroll;
        next();
    } catch (err) { next(err); }
};

// 정산서를 발행한 사장님 → req.payroll   (pay)
exports.isPayrollIssuer = async (req, res, next) => {
    try {
        const payroll = await Payroll.findByPk(idOf(req));
        if (!payroll) throw new HttpError(404, '정산서를 찾을 수 없습니다.');
        if (payroll.ownerId !== req.user.id) throw new HttpError(403, '발행한 사장님만 할 수 있습니다.');
        req.payroll = payroll;
        next();
    } catch (err) { next(err); }
};

// 정산서를 받는 알바생 → req.payroll   (dispute)
exports.isPayrollWorker = async (req, res, next) => {
    try {
        const payroll = await Payroll.findByPk(idOf(req));
        if (!payroll) throw new HttpError(404, '정산서를 찾을 수 없습니다.');
        if (payroll.workerId !== req.user.id) throw new HttpError(403, '정산서를 받는 알바생만 할 수 있습니다.');
        req.payroll = payroll;
        next();
    } catch (err) { next(err); }
};

// 알림 주인 → req.notification   (read · remove)
exports.isNotificationOwner = async (req, res, next) => {
    try {
        const notification = await Notification.findByPk(idOf(req));
        if (!notification) throw new HttpError(404, '알림을 찾을 수 없습니다.');
        if (notification.userId !== req.user.id) throw new HttpError(403, '본인의 알림만 처리할 수 있습니다.');
        req.notification = notification;
        next();
    } catch (err) { next(err); }
};
