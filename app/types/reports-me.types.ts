export interface EmployeeMonthlyReportResponse {
  employee: {
    id: number;
    fullName: string;
    employeeCode: string;
    joinDate: string;              // ISO date, e.g. "2023-01-15"
    position: string | null;
    department: string | null;
    contractType: 'PROBATION' | 'FIXED_TERM' | 'INDEFINITE' | 'SEASONAL' | null;
  };
  period: { month: number; year: number };
  attendance: {
    workingDays: number;       // công định mức (từ đầu tháng đến hôm nay)
    actualWorkDays: number;    // công thực tế (PRESENT + LATE)
    businessTripDays: number;  // ngày công tác (workType=BUSINESS_TRIP)
    annualLeaveDays: number;   // nghỉ phép năm (P)
    unpaidLeaveDays: number;   // nghỉ không lương (KL)
    welfareLeaveDays: number;  // nghỉ chế độ (R)
    publicHolidayDays: number; // nghỉ lễ rơi vào workDay
    totalPayrollDays: number;  // tổng công tính lương
    totalActualDays: number;   // tổng công ăn ca (= actualWorkDays)
  };
  overtime: {
    normalHours: number;         // OT ngày thường (rate 150)
    sundayHours: number;         // OT chủ nhật (rate 200)
    holidayOnlineHours: number;  // OT ngày lễ online (rate 300)
    holidayOfflineHours: number; // OT ngày lễ offline (rate 300)
    totalHours: number;
  };
  violations: {
    lateCount: number;         // vi phạm LATE bị REJECTED
    earlyCount: number;        // vi phạm EARLY bị REJECTED
    forgotCheckCount: number;  // FORGOT_CHECKIN + FORGOT_CHECKOUT bị REJECTED
    totalCount: number;
  };
}

export interface QueryMonthlyReportParams {
  month: number; // bắt buộc, 1-12
  year: number;  // bắt buộc, >= 2020
}