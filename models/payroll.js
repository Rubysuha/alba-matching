const Sequelize = require('sequelize');

// 정산서: 사장님이 기간을 정해 발행하면 서버가 확인된 근무 기록으로 급여를 계산한다
// 발행 시점의 시급(hourlyPay)을 저장하므로, 나중에 공고 시급이 바뀌어도 이미 발행된 금액은 바뀌지 않는다
module.exports = class Payroll extends Sequelize.Model {
    static init(sequelize) {
        return super.init({
            applicationId: { type: Sequelize.INTEGER, allowNull: false },
            ownerId: { type: Sequelize.INTEGER, allowNull: false },     // 발행한 사장님
            workerId: { type: Sequelize.INTEGER, allowNull: false },    // 받는 알바생
            periodStart: { type: Sequelize.DATEONLY, allowNull: false },
            periodEnd: { type: Sequelize.DATEONLY, allowNull: false },
            totalMinutes: { type: Sequelize.INTEGER, allowNull: false },
            hourlyPay: { type: Sequelize.INTEGER, allowNull: false },
            basePay: { type: Sequelize.INTEGER, allowNull: false },
            weeklyHolidayPay: { type: Sequelize.INTEGER, allowNull: false },
            totalPay: { type: Sequelize.INTEGER, allowNull: false },
            status: {
                type: Sequelize.ENUM('issued', 'paid', 'disputed'),
                allowNull: false,
                defaultValue: 'issued'
            },
            disputeReason: { type: Sequelize.STRING(500), allowNull: true },
            paidAt: { type: Sequelize.DATE, allowNull: true }
        }, {
            sequelize,
            timestamps: true,
            modelName: 'Payroll',
            tableName: 'payrolls',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
        });
    }

    static associate(db) {
        db.Payroll.belongsTo(db.Application, { foreignKey: 'applicationId' });
        db.Payroll.belongsTo(db.User, { as: 'owner', foreignKey: 'ownerId' });
        db.Payroll.belongsTo(db.User, { as: 'worker', foreignKey: 'workerId' });
    }
};
