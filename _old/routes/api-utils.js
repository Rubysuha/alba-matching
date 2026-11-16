// 공통 응답 형식: 성공 {"result":"Success","data":…} / 실패 {"result":"Fail","error":"…"}

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const ok = (res, data, status = 200) =>
    res.status(status).json({ result: 'Success', data });

const fail = (res, status, error) =>
    res.status(status).json({ result: 'Fail', error });

// async 핸들러의 에러를 JSON 응답으로 바꿔 준다
const wrap = handler => async (req, res, next) => {
    try {
        await handler(req, res, next);
    } catch (err) {
        if (err instanceof HttpError) return fail(res, err.status, err.message);
        if (err.name === 'SequelizeUniqueConstraintError')
            return fail(res, 409, '이미 존재하는 데이터입니다.');
        console.error(err);
        fail(res, 500, '서버 오류가 발생했습니다.');
    }
};

// ---------- 입력 검증 ----------
// 정수면 숫자, 아니면 null
const intOf = v =>
    (typeof v === 'number' || typeof v === 'string') && /^-?\d+$/.test(String(v).trim())
        ? Number(v) : null;

const positiveInt = v => {
    const n = intOf(v);
    return n !== null && n > 0 ? n : null;
};

// 1~5 정수 평점
const ratingOf = v => {
    const n = intOf(v);
    return n !== null && n >= 1 && n <= 5 ? n : null;
};

// 공백 제거 후 1~max자 문자열, 아니면 null
const text = (v, max) => {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    return s.length >= 1 && s.length <= max ? s : null;
};

// spec = { 필드: 파서 }, required = 필수 필드 목록
// 검증을 통과한 필드만 담아 돌려주고, 실패하면 400
const parseFields = (body, spec, required = []) => {
    const out = {};
    for (const [key, parse] of Object.entries(spec)) {
        if (body[key] === undefined) {
            if (required.includes(key)) throw new HttpError(400, `${key}은(는) 필수입니다.`);
            continue;
        }
        const value = parse(body[key]);
        if (value === null) throw new HttpError(400, `${key} 값이 올바르지 않습니다.`);
        out[key] = value;
    }
    return out;
};

// ?page=1&limit=10 (limit 최대 50)
const pageOf = query => {
    const page = Math.max(positiveInt(query.page) || 1, 1);
    const limit = Math.min(positiveInt(query.limit) || 10, 50);
    return { page, limit, offset: (page - 1) * limit };
};

module.exports = {
    HttpError, ok, fail, wrap,
    intOf, positiveInt, ratingOf, text, parseFields, pageOf
};
