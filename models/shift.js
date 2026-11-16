const Sequelize = require('sequelize');

// 근무 일정: 확정된 지원에 사장님이 등록하고, 알바생이 출·퇴근을 체크하고, 사장님이 확인한다
// 예정(scheduled) → 출근(checked_in) → 퇴근(checked_out) → 확인(confirmed) / 결근(no_show)
module.exports = class Shift extends Sequelize.Model {
    static init(sequelize) {
        return super.init({
            applicationId: { type: Sequelize.INTEGER, allowNull: false },
            startAt: { type: Sequelize.DATE, allowNull: false },
            endAt: { type: Sequelize.DATE, allowNull: false },
            checkInAt: { type: Sequelize.DATE, allowNull: true },
            checkOutAt: { type: Sequelize.DATE, allowNull: true },
            workedMinutes: { type: Sequelize.INTEGER, allowNull: true },
            status: {
                type: Sequelize.ENUM('scheduled', 'checked_in', 'checked_out', 'confirmed', 'no_show'),
                allowNull: false,
                defaultValue: 'scheduled'
            }
        }, {
            sequelize,
            timestamps: true,
            modelName: 'Shift',
            tableName: 'shifts',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
        });
    }

    static associate(db) {
        db.Shift.belongsTo(db.Application, { foreignKey: 'applicationId' });
    }
};
