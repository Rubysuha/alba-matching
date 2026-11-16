// 2026년 최저임금 시간급 (고용노동부 고시 제2025-47호)
exports.MIN_HOURLY_WAGE = 10320;

// 출근 체크는 예정 시작 시간 ±30분 안에서만 가능
exports.CHECK_IN_WINDOW_MINUTES = 30;

// 주휴수당: 한 주 확인된 근무가 15시간 이상이고 결근이 없어야 한다. 40시간 이상이면 8시간분으로 고정
exports.WEEKLY_HOLIDAY_MIN_MINUTES = 15 * 60;
exports.WEEKLY_FULL_MINUTES = 40 * 60;

// 확정 인원으로 세는 지원 상태 (근무를 마친 사람도 그 자리를 채운 것이다)
exports.CONFIRMED_STATUSES = ['accepted', 'completed'];

exports.APPLICATION_STATUSES = ['pending', 'accepted', 'completed', 'rejected'];

exports.NOTIFICATION_TYPES = [
    'application_received',   // 지원 접수 (사장님에게)
    'application_accepted',   // 확정
    'application_rejected',   // 거절
    'application_completed',  // 완료
    'shift_created',          // 일정 등록
    'payroll_issued',         // 정산 발행
    'payroll_disputed',       // 이의제기
    'review_created'          // 후기 등록
];
