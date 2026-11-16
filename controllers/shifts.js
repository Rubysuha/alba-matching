const { Op } = require('sequelize');
const { sequelize, Job, User, Application, Shift } = require('../models');
const { HttpError, ok } = require('../utils/response');
const { positiveInt, dateOf } = require('../utils/validate');
const { CHECK_IN_WINDOW_MINUTES } = require('../utils/constants');
const notify = require('../utils/notify');

// POST /shifts - 근무 일정 등록 (사장님)
// 400 시간 오류, 403 남의 공고, 404, 409 확정 아님·시간 겹침
exports.create = async (req, res, next) => {
    try {
        const applicationId = positiveInt(req.body.applicationId);
        const startAt = dateOf(req.body.startAt);
        const endAt = dateOf(req.body.endAt);
        if (applicationId === null) throw new HttpError(400, 'applicationId는 필수입니다.');
        if (!startAt || !endAt) throw new HttpError(400, 'startAt, endAt은 올바른 날짜·시간이어야 합니다.');
        if (endAt <= startAt) throw new HttpError(400, 'endAt은 startAt보다 늦어야 합니다.');

        const application = await Application.findByPk(applicationId, { include: [Job] });
        if (!application) throw new HttpError(404, '지원을 찾을 수 없습니다.');
        if (application.Job.ownerId !== req.user.id) throw new HttpError(403, '내 공고의 지원에만 일정을 등록할 수 있습니다.');
        if (application.status !== 'accepted') throw new HttpError(409, '확정된 지원에만 일정을 등록할 수 있습니다.');

        // 같은 알바생의 다른 일정(결근 제외)과 시간이 겹치면 409
        const overlapped = await Shift.findOne({
            where: {
                status: { [Op.ne]: 'no_show' },
                startAt: { [Op.lt]: endAt },
                endAt: { [Op.gt]: startAt }
            },
            include: [{ model: Application, where: { applicantId: application.applicantId }, required: true, attributes: [] }]
        });
        if (overlapped) throw new HttpError(409, '같은 알바생의 다른 근무 일정과 시간이 겹칩니다.');

        const shift = await sequelize.transaction(async t => {
            const created = await Shift.create({ applicationId, startAt, endAt, status: 'scheduled' }, { transaction: t });
            await notify(application.applicantId, 'shift_created',
                `'${application.Job.title}' 근무 일정이 등록되었습니다.`, created.id, { transaction: t });
            return created;
        });
        ok(res, shift, 201);
    } catch (err) { next(err); }
};

// GET /shifts/me - 내 근무 일정 (?from=&to= 기간 필터)
exports.listMine = async (req, res, next) => {
    try {
        const where = {};
        if (req.query.from !== undefined || req.query.to !== undefined) {
            where.startAt = {};
            if (req.query.from !== undefined) {
                const from = dateOf(req.query.from);
                if (!from) throw new HttpError(400, 'from이 올바르지 않습니다.');
                where.startAt[Op.gte] = from;
            }
            if (req.query.to !== undefined) {
                const to = dateOf(req.query.to);
                if (!to) throw new HttpError(400, 'to가 올바르지 않습니다.');
                where.startAt[Op.lte] = to;
            }
        }

        const shifts = await Shift.findAll({
            where,
            include: [{
                model: Application, where: { applicantId: req.user.id }, required: true,
                include: [{ model: Job, attributes: ['id', 'title', 'region'] }]
            }],
            order: [['startAt', 'ASC'], ['id', 'ASC']]
        });
        ok(res, shifts);
    } catch (err) { next(err); }
};

// GET /shifts/jobs/:jobId - 공고별 근무 일정 (사장님, 403 남의 공고)
exports.listByJob = async (req, res, next) => {
    try {
        const jobId = positiveInt(req.params.jobId);
        if (jobId === null) throw new HttpError(400, 'jobId가 올바르지 않습니다.');
        const job = await Job.findByPk(jobId);
        if (!job) throw new HttpError(404, '공고를 찾을 수 없습니다.');
        if (job.ownerId !== req.user.id) throw new HttpError(403, '내 공고의 일정만 볼 수 있습니다.');

        const shifts = await Shift.findAll({
            include: [{
                model: Application, where: { jobId }, required: true,
                include: [{ model: User, as: 'applicant', attributes: ['id', 'name'] }]
            }],
            order: [['startAt', 'ASC'], ['id', 'ASC']]
        });
        ok(res, shifts);
    } catch (err) { next(err); }
};

// ★ PATCH /shifts/:id/check-in - 출근 (알바생)
// 409: 예정 상태 아님, 예정 시작 시간 ±30분 창 밖
exports.checkIn = async (req, res, next) => {
    try {
        const shift = req.shift;
        if (shift.status !== 'scheduled') throw new HttpError(409, '예정 상태의 일정만 출근할 수 있습니다.');

        const now = new Date();
        const gapMinutes = Math.abs(now - new Date(shift.startAt)) / 60000;
        if (gapMinutes > CHECK_IN_WINDOW_MINUTES)
            throw new HttpError(409, `출근은 예정 시작 시간 ±${CHECK_IN_WINDOW_MINUTES}분 안에서만 가능합니다.`);

        await shift.update({ checkInAt: now, status: 'checked_in' });
        ok(res, shift);
    } catch (err) { next(err); }
};

// PATCH /shifts/:id/check-out - 퇴근 (알바생)
// 409: 출근 상태 아님. workedMinutes = checkOutAt - checkInAt
exports.checkOut = async (req, res, next) => {
    try {
        const shift = req.shift;
        if (shift.status !== 'checked_in') throw new HttpError(409, '출근 상태의 일정만 퇴근할 수 있습니다.');

        const now = new Date();
        const workedMinutes = Math.max(0, Math.floor((now - new Date(shift.checkInAt)) / 60000));
        await shift.update({ checkOutAt: now, workedMinutes, status: 'checked_out' });
        ok(res, shift);
    } catch (err) { next(err); }
};

// PATCH /shifts/:id/confirm - 근무 확인 (사장님, 409: 퇴근 상태 아님)
exports.confirm = async (req, res, next) => {
    try {
        if (req.shift.status !== 'checked_out') throw new HttpError(409, '퇴근 상태의 일정만 확인할 수 있습니다.');

        await req.shift.update({ status: 'confirmed' });
        ok(res, req.shift);
    } catch (err) { next(err); }
};

// PATCH /shifts/:id/no-show - 결근 처리 (사장님, 409: 예정 아님·시작 시간 전)
exports.markNoShow = async (req, res, next) => {
    try {
        if (req.shift.status !== 'scheduled') throw new HttpError(409, '예정 상태의 일정만 결근 처리할 수 있습니다.');
        if (new Date() < new Date(req.shift.startAt))
            throw new HttpError(409, '시작 시간이 지난 일정만 결근 처리할 수 있습니다.');

        await req.shift.update({ status: 'no_show' });
        ok(res, req.shift);
    } catch (err) { next(err); }
};
