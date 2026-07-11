const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const getNazimFeeScope = (user) => (user?.feeScope === 'female' ? 'female' : 'male');

const studentGenderFilter = (feeScope) => ({
  role: 'student',
  gender: feeScope,
  isActive: { $ne: false },
});

const parseMonthYear = (month, year) => {
  const reportMonth = parseInt(month, 10);
  const reportYear = parseInt(year, 10);
  if (!reportMonth || reportMonth < 1 || reportMonth > 12 || !reportYear) return null;
  return { reportMonth, reportYear };
};

const monthYearQuery = (reportMonth, reportYear) => {
  const monthName = MONTH_NAMES[reportMonth - 1];
  const m = String(reportMonth);
  const y = reportYear;
  const ys = String(reportYear);
  return {
    $or: [
      { month: m, year: y }, { month: monthName, year: y },
      { month: m, year: ys }, { month: monthName, year: ys },
    ],
  };
};

const isCurrentCalendarMonth = (reportMonth, reportYear) => {
  const now = new Date();
  return reportMonth === now.getMonth() + 1 && reportYear === now.getFullYear();
};

const feeStatusForUi = (status) => (status === 'paid' ? 'paid' : 'unpaid');

const dueDateForMonth = (reportMonth, reportYear, dueDay = 10) =>
  new Date(reportYear, reportMonth - 1, dueDay);

module.exports = {
  MONTH_NAMES, getNazimFeeScope, studentGenderFilter, parseMonthYear,
  monthYearQuery, isCurrentCalendarMonth, feeStatusForUi, dueDateForMonth,
};
