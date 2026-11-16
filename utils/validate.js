const { HttpError } = require('./response');

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

// ISO 날짜시간 문자열 → Date, 아니면 null
const dateOf = v => {
    if (typeof v !== 'string' || v.trim() === '') return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

// 'YYYY-MM-DD' 형식의 실제 있는 날짜면 그 문자열, 아니면 null
const dateOnlyOf = v => {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const d = new Date(`${v}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const back = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return back === v ? v : null;
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

module.exports = { intOf, positiveInt, ratingOf, text, dateOf, dateOnlyOf, parseFields, pageOf };
