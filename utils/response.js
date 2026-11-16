// 성공 응답: ok(res, data, status)  →  {"result":"Success","data":…}
// 실패 응답: 어디서든 throw new HttpError(status, message)  →  app.js 에러 핸들러가 {"result":"Fail","error":…} 로 응답
class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const ok = (res, data, status = 200) =>
    res.status(status).json({ result: 'Success', data });

module.exports = { HttpError, ok };
