// 급여 계산 - DB 없이 단위 테스트할 수 있는 순수 함수
// 단순화한 규칙: 실제 법은 실근무시간이 아니라 소정근로시간 기준이며,
// 야간·연장·휴일수당과 5인 이상 사업장 구분은 범위 밖
const { WEEKLY_HOLIDAY_MIN_MINUTES, WEEKLY_FULL_MINUTES } = require('./constants');

const pad = n => String(n).padStart(2, '0');

// 로컬 시간 기준 'YYYY-MM-DD'
const dayKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// 그 날이 속한 주(월~일)의 월요일 날짜
const weekKey = date => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return dayKey(d);
};

// shifts: 기간 안의 모든 근무 일정 [{ startAt, workedMinutes, status }]
// hourlyPay: 정산 발행 시점의 시급
const calculatePayroll = (shifts, hourlyPay) => {
    // 1. 확인된(confirmed) 근무만 모은다
    const confirmed = shifts.filter(s => s.status === 'confirmed');
    const totalMinutes = confirmed.reduce((sum, s) => sum + (s.workedMinutes || 0), 0);

    // 2. 기본급 = 총 근무분 × 시급 ÷ 60 (원 단위 내림)
    const basePay = Math.floor(totalMinutes * hourlyPay / 60);

    // 3. 주(월~일) 단위로 묶는다
    const weeks = new Map();
    for (const s of shifts) {
        const key = weekKey(new Date(s.startAt));
        if (!weeks.has(key)) weeks.set(key, { minutes: 0, noShows: 0 });
        const week = weeks.get(key);
        if (s.status === 'confirmed') week.minutes += s.workedMinutes || 0;
        if (s.status === 'no_show') week.noShows += 1;
    }

    // 주휴수당 = (그 주 근무시간 ÷ 40) × 8 × 시급, 40시간 이상이면 8시간분으로 고정
    //          = 근무분 × 시급 ÷ 300  (원 단위 내림)
    let weeklyHolidayPay = 0;
    for (const week of weeks.values()) {
        if (week.minutes >= WEEKLY_HOLIDAY_MIN_MINUTES && week.noShows === 0) {
            const eligible = Math.min(week.minutes, WEEKLY_FULL_MINUTES);
            weeklyHolidayPay += Math.floor(eligible * hourlyPay / 300);
        }
    }

    // 4. 총 지급액 = 기본급 + 주휴수당
    return { totalMinutes, basePay, weeklyHolidayPay, totalPay: basePay + weeklyHolidayPay };
};

module.exports = { calculatePayroll, dayKey, weekKey };
