const { Op } = require('sequelize');
const { sequelize, Job, Resume, User, Application, Shift } = require('../models');
const { HttpError, ok } = require('../utils/response');
const { positiveInt, ratingOf, text } = require('../utils/validate');
const { CONFIRMED_STATUSES, APPLICATION_STATUSES } = require('../utils/constants');
const notify = require('../utils/notify');

const statusFilter = status => {
    if (status === undefined) return {};
    if (!APPLICATION_STATUSES.includes(status))
        throw new HttpError(400, `status는 ${APPLICATION_STATUSES.join(', ')} 중 하나여야 합니다.`);
    return { status };
};

// POST /applications - 지원하기
// 400 필수값, 403 본인 공고·남의 이력서, 404, 409 마감·중복
exports.apply = async (req, res, next) => {
    try {
        const jobId = positiveInt(req.body.jobId);
        const resumeId = positiveInt(req.body.resumeId);
        if (jobId === null || resumeId === null) throw new HttpError(400, 'jobId, resumeId는 필수입니다.');

        let message = null;
        if (req.body.message !== undefined) {
            message = text(req.body.message, 500);
            if (message === null) throw new HttpError(400, 'message 값이 올바르지 않습니다.');
        }

        const resume = await Resume.findByPk(resumeId);
        if (!resume) throw new HttpError(404, '이력서를 찾을 수 없습니다.');
        const job = await Job.findByPk(jobId);
        if (!job) throw new HttpError(404, '공고를 찾을 수 없습니다.');

        if (resume.userId !== req.user.id) throw new HttpError(403, '본인의 이력서로만 지원할 수 있습니다.');
        if (job.ownerId === req.user.id) throw new HttpError(403, '본인 공고에는 지원할 수 없습니다.');
        if (job.status !== 'open') throw new HttpError(409, '모집이 마감된 공고입니다.');

        // 같은 공고 + 같은 사람은 한 번만 (거절당해도 다른 이력서로 재지원 불가). DB 의 UNIQUE 가 마지막 장치
        const duplicated = await Application.findOne({ where: { jobId, applicantId: req.user.id } });
        if (duplicated) throw new HttpError(409, '이미 지원한 공고입니다.');

        const application = await sequelize.transaction(async t => {
            // applicantId 는 req.user.id 로 서버가 채운다
            const created = await Application.create(
                { jobId, resumeId, message, applicantId: req.user.id, status: 'pending' },
                { transaction: t }
            );
            await notify(job.ownerId, 'application_received',
                `${req.user.name}님이 '${job.title}' 공고에 지원했습니다.`, created.id, { transaction: t });
            return created;
        });
        ok(res, application, 201);
    } catch (err) { next(err); }
};

// GET /applications/sent - 내가 지원한 목록 (?status= 필터)
exports.listSent = async (req, res, next) => {
    try {
        const applications = await Application.findAll({
            where: { applicantId: req.user.id, ...statusFilter(req.query.status) },
            include: [{ model: Job, include: [{ model: User, as: 'owner', attributes: ['id', 'name'] }] }],
            order: [['createdAt', 'DESC'], ['id', 'DESC']]
        });
        ok(res, applications);
    } catch (err) { next(err); }
};

// GET /applications/received - 내 공고에 들어온 지원 (?status= ?jobId= 필터)
// 남의 공고 jobId 를 넣어도 include 조건 때문에 결과가 0건이라 권한 검사를 따로 하지 않아도 된다
exports.listReceived = async (req, res, next) => {
    try {
        const where = statusFilter(req.query.status);
        if (req.query.jobId !== undefined) {
            const jobId = positiveInt(req.query.jobId);
            if (jobId === null) throw new HttpError(400, 'jobId가 올바르지 않습니다.');
            where.jobId = jobId;
        }

        const applications = await Application.findAll({
            where,
            include: [
                { model: Job, where: { ownerId: req.user.id }, required: true,
                  attributes: ['id', 'title', 'region', 'pay', 'headcount', 'status'] },
                { model: Resume, attributes: ['id', 'title', 'intro', 'desiredRegion'] },
                { model: User, as: 'applicant', attributes: ['id', 'name'] }
            ],
            order: [['createdAt', 'DESC'], ['id', 'DESC']]
        });
        ok(res, applications);
    } catch (err) { next(err); }
};

// ★ PATCH /applications/:id/accept - 채용 확정
// 409: 대기 아님·마감·정원 참
exports.accept = async (req, res, next) => {
    try {
        const result = await sequelize.transaction(async t => {
            // 같은 공고에 동시에 확정을 눌러도 하나씩 순서대로 처리되도록 공고 행을 잠근다
            const job = await Job.findByPk(req.application.jobId, { transaction: t, lock: t.LOCK.UPDATE });
            const application = await Application.findByPk(req.application.id, { transaction: t });

            if (application.status !== 'pending' || job.status === 'closed')
                throw new HttpError(409, '대기 상태의 지원이고 모집중인 공고만 확정할 수 있습니다.');

            const confirmed = await Application.count({
                where: { jobId: job.id, status: { [Op.in]: CONFIRMED_STATUSES } },
                transaction: t
            });
            if (confirmed >= job.headcount) throw new HttpError(409, '모집 정원이 가득 찼습니다.');

            application.status = 'accepted';
            application.acceptedAt = new Date();
            await application.save({ transaction: t });

            // 확정 인원 + 1 이 headcount 이상이면 공고를 마감한다
            if (confirmed + 1 >= job.headcount) {
                job.status = 'closed';
                await job.save({ transaction: t });
            }

            // 확정 처리와 알림 생성은 한 트랜잭션: 하나라도 실패하면 둘 다 취소된다
            await notify(application.applicantId, 'application_accepted',
                `'${job.title}' 지원이 확정되었습니다.`, application.id, { transaction: t });

            return { application, job, confirmedCount: confirmed + 1 };
        });

        ok(res, {
            application: result.application,
            job: {
                id: result.job.id,
                status: result.job.status,
                headcount: result.job.headcount,
                confirmedCount: result.confirmedCount
            }
        });
    } catch (err) { next(err); }
};

// PATCH /applications/:id/reject - 지원 거절 (409: 대기 아님)
exports.reject = async (req, res, next) => {
    try {
        if (req.application.status !== 'pending')
            throw new HttpError(409, '대기 상태의 지원만 거절할 수 있습니다.');

        await sequelize.transaction(async t => {
            await req.application.update({ status: 'rejected' }, { transaction: t });
            await notify(req.application.applicantId, 'application_rejected',
                `'${req.application.Job.title}' 지원이 거절되었습니다.`, req.application.id, { transaction: t });
        });
        ok(res, req.application);
    } catch (err) { next(err); }
};

// PATCH /applications/:id/complete - 근무 완료 처리
// 400: 평점이 1~5 아님, 409: 확정 아님
// 확장 규칙: 모든 근무 일정이 확인(confirmed) 또는 결근(no_show)으로 끝나 있고, 확인된 근무가 1건 이상이어야 한다 (아니면 409)
exports.complete = async (req, res, next) => {
    try {
        const rating = ratingOf(req.body.rating);
        if (rating === null) throw new HttpError(400, 'rating(성실도 평점)은 1~5 사이의 정수여야 합니다.');

        if (req.application.status !== 'accepted')
            throw new HttpError(409, '확정된 지원만 완료 처리할 수 있습니다.');

        const shifts = await Shift.findAll({ where: { applicationId: req.application.id } });
        const unfinished = shifts.filter(s => !['confirmed', 'no_show'].includes(s.status));
        const confirmed = shifts.filter(s => s.status === 'confirmed');
        if (unfinished.length > 0)
            throw new HttpError(409, '아직 확인·결근 처리되지 않은 근무 일정이 있습니다.');
        if (confirmed.length < 1)
            throw new HttpError(409, '확인된 근무가 1건 이상 있어야 완료 처리할 수 있습니다.');

        await sequelize.transaction(async t => {
            await req.application.update(
                { status: 'completed', ownerRating: rating, completedAt: new Date() },
                { transaction: t }
            );
            await notify(req.application.applicantId, 'application_completed',
                `'${req.application.Job.title}' 근무가 완료 처리되었습니다. (성실도 ${rating}점)`,
                req.application.id, { transaction: t });
        });
        ok(res, req.application);
    } catch (err) { next(err); }
};
