import type {
	KpiAutoKey,
	KpiDirection,
	KpiGrade,
	KpiGradeScale,
	KpiReviewEvent,
	KpiReviewLine,
	KpiReviewStatus,
} from '~/types/kpi.types';

/**
 * Hàm thuần của phần KPI. Không tính điểm, không hỏi quyền: điểm, xếp loại, `permissions` đều do máy chủ
 * trả (`docs/backend/bridges/kpi.md`), ở đây chỉ đặt chữ, định dạng số và chọn màu.
 * KPI chỉ xem và xuất: không có chữ nào về lương, thưởng.
 */

/** Năm bước của phiếu, đúng thứ tự (bridge mục 2). */
export const KPI_STEPS: KpiReviewStatus[] = ['OPEN', 'MANAGER_REVIEW', 'FEEDBACK', 'PENDING_FINAL', 'PUBLISHED'];

/** Nhãn dự phòng; máy chủ vẫn trả `statusLabel` kèm mỗi phiếu. */
export const KPI_STATUS_LABELS: Record<KpiReviewStatus, string> = {
	OPEN: 'Đang mở',
	MANAGER_REVIEW: 'Chờ cấp trên đánh giá',
	FEEDBACK: 'Chờ phản hồi',
	PENDING_FINAL: 'Chờ chốt',
	PUBLISHED: 'Đã công bố',
};

/** Nhãn ngắn cho thanh bước trên màn hẹp. */
export const KPI_STEP_SHORT: Record<KpiReviewStatus, string> = {
	OPEN: 'Đang mở',
	MANAGER_REVIEW: 'Cấp trên chấm',
	FEEDBACK: 'Phản hồi',
	PENDING_FINAL: 'Chờ chốt',
	PUBLISHED: 'Công bố',
};

export const KPI_STATUS_CLASS: Record<KpiReviewStatus, string> = {
	OPEN: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
	MANAGER_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
	FEEDBACK: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
	PENDING_FINAL: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
	PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
};

export const KPI_DIRECTION_LABELS: Record<KpiDirection, string> = {
	HIGHER: 'Càng cao càng tốt',
	LOWER: 'Càng thấp càng tốt',
	PASS_FAIL: 'Đạt hoặc không đạt',
	BANDS: 'Theo mốc',
};

/** Câu ⓘ một dòng cho các khái niệm của KPI (mục 9.2 "Hướng dẫn người mới"). */
export const KPI_HINTS = {
	indicator: 'Chỉ tiêu là một thứ đo được, ví dụ tỷ lệ việc xong đúng hạn. Chỉ tiêu tự động do hệ thống đếm từ công việc và chấm công.',
	template: 'Mẫu đánh giá gom các chỉ tiêu, mức giao và trọng số cho một phòng hay một vị trí. Tổng trọng số phải đúng 100%.',
	gradeScale: 'Thang xếp loại đổi tổng điểm thành A, B, C, D. Thang mới chỉ dùng cho kỳ mở sau ngày áp dụng.',
	cap: 'Mức trần chặn tỷ lệ hoàn thành, ví dụ 120% thì làm gấp đôi vẫn chỉ tính 120%.',
	floor: 'Dưới mức sàn thì tỷ lệ hoàn thành tính bằng 0.',
	manualScale: 'Người chấm bấm một trong năm nút từ 1 tới 5 thay vì gõ số.',
	effectiveWeight: 'Chỉ tiêu không áp dụng thì trọng số của nó chia lại cho các chỉ tiêu còn lại.',
	provisional: 'Điểm tạm tính thay đổi theo số liệu tới khi cấp trên gửi đánh giá.',
} as const;

const NUM = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const NUM1 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

/** Số kiểu Việt Nam: `98.1` thành "98,1", `1234` thành "1.234". `null` thì "—". */
export function kpiNum(v: number | null | undefined, digits: 1 | 2 = 2): string {
	if (v == null || Number.isNaN(v)) return '—';
	return (digits === 1 ? NUM1 : NUM).format(v);
}

/** "75%" hay "98,1%"; `null` thì "—". */
export function kpiPct(v: number | null | undefined): string {
	if (v == null) return '—';
	return `${kpiNum(v, 1)}%`;
}

/** Số kèm đơn vị: "%" dính liền, đơn vị chữ cách một khoảng ("46 điểm"). */
export function kpiWithUnit(v: number | null | undefined, unit: string): string {
	if (v == null) return '—';
	if (!unit) return kpiNum(v);
	return unit === '%' ? `${kpiNum(v)}%` : `${kpiNum(v)} ${unit}`;
}

/** Kết quả của một dòng theo kiểu chỉ tiêu: đạt hay không đạt, điểm 1–5, hay số kèm đơn vị. */
export function kpiValueText(line: Pick<KpiReviewLine, 'direction' | 'manualScale' | 'unit'>, v: number | null | undefined): string {
	if (v == null) return '—';
	if (line.direction === 'PASS_FAIL') return v >= 1 ? 'Đạt' : 'Không đạt';
	if (line.manualScale) return `${kpiNum(v)}/5`;
	return kpiWithUnit(v, line.unit);
}

/** Mức giao: đạt hay không đạt thì ghi "Đạt"; theo mốc thì ghi "≤ 10%". */
export function kpiTargetText(line: Pick<KpiReviewLine, 'direction' | 'manualScale' | 'unit'>, target: number): string {
	if (line.direction === 'PASS_FAIL') return 'Đạt';
	if (line.manualScale) return `${kpiNum(target)}/5`;
	if (line.direction === 'BANDS' || line.direction === 'LOWER') return `≤ ${kpiWithUnit(target, line.unit)}`;
	return kpiWithUnit(target, line.unit);
}

/** Ghép tay từ `formatToParts` vì mỗi trình duyệt in `vi-VN` một kiểu ("26-11", "26/11"). */
const VN_PARTS = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Asia/Ho_Chi_Minh',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
});
function vnParts(iso: string): Record<'year' | 'month' | 'day' | 'hour' | 'minute', string> {
	const parts = VN_PARTS.formatToParts(new Date(iso));
	const get = (t: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === t)?.value ?? '';
	return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

/** "01:00 ngày 25/11" theo giờ Việt Nam (mục 9.2 "Tính lúc …"). */
export function kpiAtText(iso: string | null | undefined): string {
	if (!iso) return '—';
	const p = vnParts(iso);
	return `${p.hour}:${p.minute} ngày ${p.day}/${p.month}`;
}

/** "25/11/2026" theo giờ Việt Nam cho một thời điểm. */
export function kpiDayText(iso: string | null | undefined): string {
	if (!iso) return '—';
	const p = vnParts(iso);
	return `${p.day}/${p.month}/${p.year}`;
}

/** "01/10 – 31/10/2026" cho ngày thuần `YYYY-MM-DD`. */
export function kpiRangeText(start: string, end: string): string {
	const s = start.split('-');
	const e = end.split('-');
	return `${s[2]}/${s[1]} – ${e[2]}/${e[1]}/${e[0]}`;
}

/** Còn bao nhiêu ngày (làm tròn lên) tới một thời điểm; âm là đã qua. */
export function kpiDaysLeft(iso: string | null | undefined, now: Date = new Date()): number | null {
	if (!iso) return null;
	return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}

/** "A từ 110 · B từ 95 · C từ 80 · D dưới 80" (mức cuối từ 0 ghi "dưới" ngưỡng của mức trên). */
export function kpiGradeLegend(grades: KpiGrade[]): string {
	return grades
		.map((g, i) => (i === grades.length - 1 && g.minScore === 0 && i > 0 ? `${g.label} dưới ${kpiNum(grades[i - 1]!.minScore)}` : `${g.label} từ ${kpiNum(g.minScore)}`))
		.join(' · ');
}

/** Màu xếp loại theo vị trí trong thang (cao nhất xanh, thấp nhất đỏ), không đoán theo chữ. */
export function kpiGradeClass(label: string | null | undefined, grades: KpiGrade[]): string {
	if (!label) return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
	const i = grades.findIndex(g => g.label === label);
	const n = grades.length;
	if (i < 0 || n === 0) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
	if (i === 0) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
	if (i === n - 1) return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300';
	if (i === 1) return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300';
	return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
}

/** Màu thanh phân bố, cùng thứ tự với `kpiGradeClass`. */
export function kpiGradeBarClass(label: string, grades: KpiGrade[]): string {
	const i = grades.findIndex(g => g.label === label);
	const n = grades.length;
	if (i === 0) return 'bg-emerald-500';
	if (i === n - 1) return 'bg-rose-500';
	if (i === 1) return 'bg-sky-500';
	return 'bg-amber-500';
}

/**
 * Chú thích dưới trọng số của một dòng khi trọng số hiệu lực lớn hơn trọng số gốc (UI-17a): "trọng số tăng vì 1 chỉ
 * tiêu không áp dụng". Dòng không áp dụng hay trọng số không đổi thì `null`.
 */
export function kpiWeightShiftText(lines: Pick<KpiReviewLine, 'applicable'>[], line: Pick<KpiReviewLine, 'applicable' | 'weight' | 'effectiveWeight'>): string | null {
	if (!line.applicable || line.effectiveWeight <= line.weight) return null;
	const n = lines.filter(l => !l.applicable).length;
	if (n === 0) return null;
	return `trọng số tăng vì ${n} chỉ tiêu không áp dụng`;
}

/**
 * Mọi chỉ tiêu áp dụng đều đang 0 điểm (UI-17a): người chấm gửi phiếu như vậy thì hỏi lại trước, vì thường là quên
 * chấm hay số liệu chưa về chứ ít khi thật sự cả phiếu 0 điểm. Dòng chưa có điểm tính là 0.
 */
export function kpiAllZero(lines: Pick<KpiReviewLine, 'applicable' | 'score'>[]): boolean {
	const applicable = lines.filter(l => l.applicable);
	return applicable.length > 0 && applicable.every(l => !l.score);
}

/**
 * Tên thang xếp loại để đặt giữa câu (máy chủ không có tên thang, thang phân biệt bằng ngày áp dụng):
 * "thang áp dụng từ 01/01/2026 (A từ 90 · B từ 75 · …)".
 */
export function kpiScaleName(scale: Pick<KpiGradeScale, 'effectiveFrom' | 'grades'>): string {
	const [y, m, d] = scale.effectiveFrom.split('-');
	const from = scale.effectiveFrom <= '2000-12-31' ? 'thang áp dụng từ đầu' : `thang áp dụng từ ${d}/${m}/${y}`;
	return `${from} (${kpiGradeLegend(scale.grades)})`;
}

/** Câu tổng trọng số của mẫu: "Đủ 100%", "Còn thiếu 5%", "Thừa 10%". */
export function kpiWeightText(sum: number): { ok: boolean; text: string } {
	const s = Math.round(sum * 100) / 100;
	if (s === 100) return { ok: true, text: 'Tổng trọng số đủ 100%' };
	if (s < 100) return { ok: false, text: `Tổng trọng số đang là ${kpiNum(s)}%, còn thiếu ${kpiNum(100 - s)}%` };
	return { ok: false, text: `Tổng trọng số đang là ${kpiNum(s)}%, thừa ${kpiNum(s - 100)}%` };
}

/** Bằng chứng của từng chỉ tiêu tự động: đếm gì, "đạt" nghĩa là gì (bridge mục 4.4). */
export const KPI_EVIDENCE_TEXT: Record<KpiAutoKey, { set: string; matched: string | null }> = {
	TASK_ON_TIME_ORIGINAL: { set: 'Việc được đếm trong kỳ', matched: 'đúng hạn ban đầu' },
	TASK_ON_TIME_CURRENT: { set: 'Việc được đếm trong kỳ', matched: 'đúng hạn hiện tại' },
	TASK_POINTS_ACCEPTED: { set: 'Việc nghiệm thu trong kỳ', matched: null },
	TASK_QUALITY_AVG: { set: 'Việc có điểm chất lượng', matched: null },
	TASK_RETURN_RATE: { set: 'Việc nghiệm thu trong kỳ', matched: 'từng bị trả lại' },
	TASK_DONE_COUNT: { set: 'Việc nghiệm thu trong kỳ', matched: null },
	TASK_OVERDUE_OPEN: { set: 'Việc quá hạn còn mở', matched: null },
	ATTENDANCE: { set: 'Ngày công trong kỳ', matched: null },
};

function str(v: unknown): string | null {
	return typeof v === 'string' && v.trim() ? v : null;
}

/** Câu tiếng Việt cho một mốc trên dòng thời gian của phiếu. */
export function kpiEventText(
	e: KpiReviewEvent,
	reviewer?: { id: number; fullName: string } | null,
): { title: string; detail: string | null } {
	const who = e.actor?.fullName ?? 'Hệ thống';
	const p = e.payload ?? {};
	switch (e.type) {
		case 'CREATED':
			return { title: `${who} mở kỳ, phiếu được tạo`, detail: null };
		case 'REVIEW_STARTED':
			return { title: 'Kỳ đã khép, phiếu chuyển cho cấp trên đánh giá', detail: null };
		case 'LINE_UPDATED': {
			const name = str(p.name) ?? 'một chỉ tiêu';
			const reason = str(p.reason);
			const note = str(p.note);
			const from = typeof p.from === 'number' ? kpiNum(p.from) : null;
			const to = typeof p.to === 'number' ? kpiNum(p.to) : p.to === null ? 'trống' : null;
			const change = from != null || to != null ? ` từ ${from ?? 'trống'} thành ${to ?? 'trống'}` : '';
			const parts = [reason ? `Lý do: ${reason}` : null, note ? `Ghi chú: ${note}` : null].filter(Boolean);
			return { title: `${who} sửa "${name}"${change}`, detail: parts.length ? parts.join('. ') : null };
		}
		case 'SUBMITTED':
			return { title: `${who} gửi đánh giá`, detail: str(p.comment) };
		case 'FEEDBACK':
			return { title: `${who} ${p.agreed ? 'đồng ý với kết quả' : 'không đồng ý với kết quả'}`, detail: str(p.feedback) };
		case 'FEEDBACK_EXPIRED':
			return { title: 'Hết hạn phản hồi, phiếu tự chuyển sang chờ chốt', detail: null };
		case 'FINALIZED':
			return { title: `${who} chốt điểm`, detail: null };
		case 'PUBLISHED':
			return { title: `${who} công bố kết quả`, detail: null };
		case 'REOPENED':
			return { title: `${who} mở lại phiếu`, detail: str(p.reason) };
		case 'REVIEWER_CHANGED': {
			// Máy chủ chỉ ghi id người cũ, người mới (`from`, `to`); nơi gọi truyền tên người chấm hiện tại.
			const to = typeof p.to === 'number' && reviewer && reviewer.id === p.to ? reviewer.fullName : null;
			return { title: `${who} đổi người chấm${to ? ` sang ${to}` : ''}`, detail: str(p.reason) };
		}
		case 'EMPLOYEE_TERMINATED':
			return { title: 'Nhân viên đã nghỉ việc khi phiếu chưa công bố', detail: null };
		default:
			return { title: who, detail: null };
	}
}

/**
 * Lỗi `KPI_MANUAL_SCORE_MISSING`: máy chủ gửi `details.lines` là TÊN các chỉ tiêu chưa chấm (mảng chuỗi),
 * nên dòng cần tô đỏ tìm theo tên. Nhận thêm số (id dòng) phòng khi máy chủ đổi sang id.
 */
export function kpiMissingLines(details: unknown): { names: string[]; ids: number[] } {
	const lines = (details as { lines?: unknown } | null)?.lines;
	if (!Array.isArray(lines)) return { names: [], ids: [] };
	return {
		names: lines.filter((l): l is string => typeof l === 'string'),
		ids: lines.filter((l): l is number => typeof l === 'number'),
	};
}

/** Kỳ tháng hay quý có ngày đầu hợp lệ: tháng bắt đầu ngày 1, quý ngày 1 tháng 1/4/7/10. */
export function kpiPeriodStartError(type: 'MONTH' | 'QUARTER', startDate: string): string | null {
	if (!startDate) return 'Chọn ngày đầu kỳ';
	const [, m, d] = startDate.split('-').map(Number);
	if (d !== 1) return 'Kỳ bắt đầu từ ngày 1';
	if (type === 'QUARTER' && ![1, 4, 7, 10].includes(m ?? 0)) return 'Kỳ quý bắt đầu ngày 1 tháng 1, 4, 7 hoặc 10';
	return null;
}
