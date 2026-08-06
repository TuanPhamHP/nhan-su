import type { EmploymentType } from '~/types/employee.types';

// Badge classes — quy ước UI, không phụ thuộc metadata. Tone khác cho nhóm
// "tạm thời" (INTERN/APPRENTICE/PROBATION) để HR dễ theo dõi.
export const EMPLOYMENT_TYPE_BADGE_CLS: Record<EmploymentType, string> = {
	FULL_TIME: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
	PROBATION: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
	APPRENTICE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
	INTERN: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
	PART_TIME: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
	CONTRACTOR: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

// Rule BE fix cứng: chỉ FULL_TIME và PART_TIME được xin các loại phép hưởng lương.
// FE dùng để filter dropdown và tránh submit ra 403 — BE vẫn là hàng rào cuối.
const RESTRICTED_LEAVE_CODES = new Set(['ANNUAL', 'HALF_DAY', 'WELFARE']);
const ELIGIBLE_FOR_PAID_LEAVE: readonly EmploymentType[] = ['FULL_TIME', 'PART_TIME'];

export function canRequestLeaveType(employmentType: EmploymentType | null | undefined, leaveCode: string): boolean {
	if (!RESTRICTED_LEAVE_CODES.has(leaveCode)) return true;
	if (!employmentType) return true; // chưa biết → không hide, để BE quyết định
	return (ELIGIBLE_FOR_PAID_LEAVE as readonly string[]).includes(employmentType);
}
