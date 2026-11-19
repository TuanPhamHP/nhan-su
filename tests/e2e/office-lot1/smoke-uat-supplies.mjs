/**
 * FE-23 tới FE-29: những việc thêm sau UAT đợt A ở phần văn phòng phẩm.
 *
 * Thêm phòng vào kỳ, huỷ kỳ mở nhầm, đổi hạn chót cả hai chiều, khoá sớm có báo, chốt lại và sửa
 * số thực nhận tới khi đóng kỳ, định mức hiện trước khi gõ, dòng ngoài danh mục trùng danh mục,
 * "Lấy số tháng trước" nói rõ dòng bỏ qua, và nhân viên không thấy đơn giá.
 *
 * Bài tự dựng kỳ riêng (tháng 1, 2 và 3 năm 2027) nên chạy lại được mà không đụng kỳ của bài cũ.
 */
import {
	WHO,
	api,
	apiToken,
	clearToasts,
	daysFromNow,
	dialog,
	go,
	launch,
	line,
	pickSearchable,
	selectAt,
	shot,
	signIn,
	summary,
	text,
	toastText,
	viDate,
} from './helper.mjs';

const hrToken = await apiToken(WHO.hr.email);
const sites = await api(hrToken, '/v1/office/sites');
const activeSites = (sites.json?.data ?? []).filter(s => s.isActive);
if (!activeSites.length) throw new Error('chưa có văn phòng nào — chạy smoke-settings.mjs trước');

/**
 * Văn phòng của bài: văn phòng còn HAI tháng trống trong tầm ô chọn tháng.
 *
 * Mỗi lần chạy, bài mở hai kỳ rồi khoá và đóng chúng, nên tháng cũ không dùng lại được. Sandbox
 * dùng chung nhiều bài, có lúc Hữu Nghị hết tháng trống trong khi văn phòng còn lại trống trơn —
 * cắm cứng một văn phòng thì bài không chạy lại được mà chẳng vì lỗi sản phẩm nào.
 */
const allPeriods = (await api(hrToken, '/v1/office/supply-periods')).json?.data ?? [];

function freeMonthsOf(siteId) {
	const taken = new Set(allPeriods.filter(p => p.officeSite.id === siteId).map(p => p.month));
	const free = [];
	const now = new Date();
	// Ô chọn tháng của màn chỉ có từ tháng trước tới mười hai tháng tới, nên chỉ tìm trong đó.
	for (let offset = 1; offset <= 12 && free.length < 2; offset++) {
		const at = new Date(now.getFullYear(), now.getMonth() + offset, 1);
		const month = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
		if (!taken.has(month)) free.push(month);
	}
	return free;
}

const ordered = [...activeSites].sort(
	(a, b) => Number(b.name.includes('Hữu Nghị')) - Number(a.name.includes('Hữu Nghị')),
);
let site = null;
let freePair = [];
for (const candidate of ordered) {
	const free = freeMonthsOf(candidate.id);
	if (free.length >= 2) {
		site = candidate;
		freePair = free;
		break;
	}
}
if (!site) {
	throw new Error(
		`không còn văn phòng nào có hai tháng trống: ${ordered
			.map(s => `${s.name} (${freeMonthsOf(s.id).length})`)
			.join(', ')}`,
	);
}
console.log(`bài dùng văn phòng ${site.name}`);

const browser = await launch();
const hr = await signIn(browser, WHO.hr.email);

/** Mở hộp "Mở kỳ mới" rồi điền văn phòng, tháng, hạn chót và danh sách phòng. */
async function createPeriod({ month, deadlineDays, departments }) {
	await go(hr, '/management/office/supply-periods');
	await clearToasts(hr);
	await hr.getByRole('button', { name: 'Mở kỳ mới' }).first().click();
	await hr.waitForTimeout(2000);
	const box = dialog(hr, 'Mở kỳ đăng ký văn phòng phẩm');
	await selectAt(box, hr, 0, site.name);
	await selectAt(box, hr, 1, month);
	const dateInput = box.locator('input[placeholder="dd/mm/yyyy"]').first();
	await dateInput.fill(viDate(daysFromNow(deadlineDays)));
	await dateInput.press('Enter');
	await hr.waitForTimeout(400);
	// Bỏ tick hết rồi tick đúng các phòng bài cần.
	const boxes = await box.locator('input[type="checkbox"]').all();
	for (const checkbox of boxes) if (await checkbox.isChecked()) await checkbox.click();
	for (const name of departments) {
		await box.locator('label', { hasText: name }).first().locator('input[type="checkbox"]').check();
	}
	await hr.waitForTimeout(300);
	await box.getByRole('button', { name: 'Mở kỳ', exact: true }).click();
	const toast = await toastText(hr, 20000);
	await hr.waitForTimeout(2000);
	return toast;
}

/** Id kỳ theo tháng, đọc qua API cho chắc. */
async function periodIdOfMonth(month) {
	const res = await api(hrToken, '/v1/office/supply-periods');
	return res.json?.data?.find(p => p.month === month && p.officeSite.id === site.id)?.id ?? null;
}

function monthOption(month) {
	const [year, m] = month.split('-');
	return `Tháng ${Number(m)}/${year}`;
}

const [MONTH_MAIN, MONTH_WRONG] = freePair;
// Kỳ mở nhầm ở FE-23 được mở lại cùng tháng, nên chính nó là kỳ "tháng sau" để thử lấy số kỳ
// trước ở FE-28: phòng Tài chính - Kế toán có phiếu ở cả hai kỳ.
const MONTH_NEXT = MONTH_WRONG;
console.log(`bài dùng kỳ ${monthOption(MONTH_MAIN)} và ${monthOption(MONTH_WRONG)}`);

// ─── FE-23: thêm phòng, huỷ kỳ, mở lại ────────────────────────────────────────
let mainPeriodId = await periodIdOfMonth(MONTH_MAIN);
if (!mainPeriodId) {
	const created = await createPeriod({
		month: monthOption(MONTH_MAIN),
		deadlineDays: 6,
		departments: [WHO.employeeA1.departmentId === 1 ? 'Tài chính - Kế toán' : 'Tài chính - Kế toán', 'Dịch vụ khách hàng'],
	});
	line(/Đã mở kỳ/.test(created), `FE-23 mở kỳ ${monthOption(MONTH_MAIN)} cho hai phòng`, created);
	mainPeriodId = await periodIdOfMonth(MONTH_MAIN);
} else {
	line(true, `FE-23 mở kỳ ${monthOption(MONTH_MAIN)} cho hai phòng`, 'kỳ đã có từ lần chạy trước');
}

await go(hr, `/management/office/supply-periods/${mainPeriodId}`);
const beforeAdd = await text(hr);
if (!/Trung tâm công nghệ/.test(beforeAdd)) {
	await clearToasts(hr);
	await hr.getByRole('button', { name: 'Thêm phòng' }).first().click();
	await hr.waitForTimeout(1000);
	await hr.locator('label', { hasText: 'Trung tâm công nghệ' }).first().locator('input[type="checkbox"]').check();
	await hr.waitForTimeout(300);
	await hr.getByRole('button', { name: 'Thêm vào kỳ' }).click();
	const addToast = await toastText(hr, 20000);
	line(/Đã thêm 1 phòng vào kỳ/.test(addToast), 'FE-23 thêm phòng Trung tâm công nghệ vào kỳ đang mở', addToast);
	await hr.waitForTimeout(2500);
} else {
	line(true, 'FE-23 thêm phòng Trung tâm công nghệ vào kỳ đang mở', 'phòng đã có trong kỳ từ lần chạy trước');
}

const afterAdd = await text(hr);
line(/Trung tâm công nghệ/.test(afterAdd), 'FE-23 phòng mới có phiếu trong kỳ');
console.log('ảnh:', await shot(hr, 'fe-23-add-department'));

const mgrcToken = await apiToken(WHO.managerC.email);
const mgrcNotifs = await api(mgrcToken, '/v1/notifications?page=1&limit=10');
line(
	(mgrcNotifs.json?.data ?? []).some(n => n.type === 'OFFICE_SUPPLY_PERIOD_OPENED'),
	'FE-23 trưởng phòng C nhận thông báo mở kỳ',
	(mgrcNotifs.json?.data ?? []).map(n => n.type).slice(0, 4).join(', '),
);

// Kỳ mở nhầm rồi huỷ.
let wrongPeriodId = await periodIdOfMonth(MONTH_WRONG);
if (!wrongPeriodId) {
	const created = await createPeriod({ month: monthOption(MONTH_WRONG), deadlineDays: 7, departments: ['Tài chính - Kế toán'] });
	line(/Đã mở kỳ/.test(created), `FE-23 mở kỳ ${monthOption(MONTH_WRONG)} (kỳ mở nhầm)`, created);
	wrongPeriodId = await periodIdOfMonth(MONTH_WRONG);
}
await go(hr, `/management/office/supply-periods/${wrongPeriodId}`);
await clearToasts(hr);
await hr.getByRole('button', { name: 'Huỷ kỳ' }).first().click();
await hr.waitForTimeout(800);
console.log('ảnh:', await shot(hr, 'fe-23-cancel-confirm'));
await hr.getByRole('button', { name: 'Huỷ kỳ này' }).click();
const cancelToast = await toastText(hr, 20000);
line(/Đã huỷ kỳ/.test(cancelToast), 'FE-23 huỷ được kỳ chưa ai nhập', cancelToast);
await hr.waitForTimeout(2500);
// Dọn toast trước khi đọc chữ trên trang: câu toast cũng nhắc tên kỳ vừa huỷ nên dễ đọc nhầm.
await clearToasts(hr);
// Nhận diện theo ID, không theo tên tháng: hai văn phòng có thể cùng có kỳ của một tháng, nên tên
// "Tháng 12/2026" còn trên danh sách không có nghĩa là kỳ vừa huỷ còn đó.
const cancelledCard = await hr.locator(`a[href$="/management/office/supply-periods/${wrongPeriodId}"]`).count();
line(
	cancelledCard === 0,
	'FE-23 kỳ đã huỷ biến mất khỏi danh sách',
	`${cancelledCard} thẻ còn trỏ tới kỳ ${wrongPeriodId}`,
);
line((await periodIdOfMonth(MONTH_WRONG)) === null, 'FE-23 máy chủ cũng không còn kỳ đó');
console.log('ảnh:', await shot(hr, 'fe-23-period-cancelled'));

const reopened = await createPeriod({ month: monthOption(MONTH_WRONG), deadlineDays: 7, departments: ['Tài chính - Kế toán'] });
line(/Đã mở kỳ/.test(reopened), 'FE-23 mở lại kỳ cùng tháng sau khi huỷ', reopened);
console.log('ảnh:', await shot(hr, 'fe-23-reopened'));

// ─── FE-27: định mức hiện trước khi gõ, dòng ngoài danh mục trùng danh mục ────
const a1 = await signIn(browser, WHO.employeeA1.email);
await go(a1, '/office/supplies');
await a1.waitForTimeout(2500);
// Chọn phiếu của kỳ bài vừa mở.
await a1.locator('button', { hasText: monthOption(MONTH_MAIN) }).filter({ hasText: site.name }).first().click();
await a1.waitForTimeout(2500);

const addBox = a1.locator('section', { hasText: 'Thêm mặt hàng' }).first();
await addBox.locator('div[class*="selectTrigger"]').first().click();
await a1.waitForTimeout(400);
await addBox.locator('input[class*="searchInput"]').first().fill('Giấy in A4');
await a1.waitForTimeout(800);
const optionLabel = (await addBox.locator('[class*="optionLabel"]').first().innerText()).replace(/\s+/g, ' ');
line(/định mức 5/.test(optionLabel), 'FE-27 ô chọn hiện định mức ngay trên dòng mặt hàng', optionLabel);
await addBox.locator('[class*="optionLabel"]').first().click();
await a1.waitForTimeout(500);
const quotaHint = (await addBox.innerText()).replace(/\s+/g, ' ');
line(
	/Định mức của phòng là 5 Tập mỗi tháng/.test(quotaHint),
	'FE-27 định mức hiện ngay dưới ô nhập trước khi gõ số',
	quotaHint.match(/Định mức của phòng[^.]*\./)?.[0] ?? '',
);
console.log('ảnh:', await shot(a1, 'fe-27-quota-before-typing'));

await addBox.locator('input[role="spinbutton"]').first().fill('8');
await a1.waitForTimeout(500);
await clearToasts(a1);
await addBox.getByRole('button', { name: 'Thêm dòng' }).click();
await a1.waitForTimeout(1200);
const overQuotaText = (await addBox.innerText()).replace(/\s+/g, ' ');
line(
	/Lý do vượt định mức/.test(overQuotaText),
	'FE-27 gõ vượt định mức thì ô lý do mở ra ngay, không cần gửi lên mới biết',
	overQuotaText.match(/Số này vượt định mức[^.]*\./)?.[0] ?? '',
);
await addBox.locator('input[placeholder*="quyết toán"]').first().fill('Tháng này in hợp đồng năm mới');
await a1.waitForTimeout(300);
await addBox.getByRole('button', { name: 'Thêm dòng' }).click();
const addToast = await toastText(a1, 15000);
line(/Đã thêm dòng/.test(addToast), 'FE-27 có lý do thì thêm được dòng vượt định mức', addToast);
await a1.waitForTimeout(1500);

// Dòng ngoài danh mục trùng tên mặt hàng có sẵn.
await clearToasts(a1);
await a1.getByRole('button', { name: /Mặt hàng không có trong danh mục/ }).first().click();
await a1.waitForTimeout(600);
const customBox = a1.locator('section', { hasText: 'Thêm mặt hàng' }).first();
await customBox.locator('input[placeholder*="Pin 3A"]').first().fill('BÚT BI (NOTE MÀU XANH)');
await customBox.locator('input[placeholder*="Đôi"]').first().fill('Chiếc');
await customBox.locator('input[role="spinbutton"]').last().fill('2');
await a1.waitForTimeout(300);
await customBox.getByRole('button', { name: 'Thêm', exact: true }).click();
await a1.waitForTimeout(2000);
const catalogError = (await customBox.locator('p.text-red-500').first().innerText().catch(() => '')).trim();
line(
	/danh mục/i.test(catalogError),
	'FE-27 tên trùng mặt hàng có sẵn bị từ chối kèm gợi ý chọn trong danh sách',
	catalogError,
);
console.log('ảnh:', await shot(a1, 'fe-27-line-in-catalog'));

// Thêm một dòng ngoài danh mục thật, để kỳ sau có cái mà chép.
await customBox.locator('input[placeholder*="Pin 3A"]').first().fill('Pin 3A');
await customBox.locator('input[placeholder*="Đôi"]').first().fill('Đôi');
await customBox.locator('input[role="spinbutton"]').last().fill('3');
await a1.waitForTimeout(300);
await clearToasts(a1);
await customBox.getByRole('button', { name: 'Thêm', exact: true }).click();
const customToast = await toastText(a1, 15000);
line(/Đã thêm mặt hàng ngoài danh mục/.test(customToast), 'FE-27 thêm được dòng ngoài danh mục Pin 3A', customToast);
await a1.waitForTimeout(1500);

// ─── FE-29: nhân viên không thấy đơn giá ──────────────────────────────────────
const pickerText = (await addBox.innerText()).replace(/\s+/g, ' ');
await addBox.locator('div[class*="selectTrigger"]').first().click();
await a1.waitForTimeout(600);
const optionsText = (await a1.locator('div[class*="dropdown"]').first().innerText()).replace(/\s+/g, ' ');
await a1.keyboard.press('Escape');
line(
	!/đ\b|VND|đơn giá/i.test(optionsText),
	'FE-29 ô chọn mặt hàng của nhân viên không có đơn giá',
	optionsText.slice(0, 120),
);
const requestText = await text(a1);
line(
	!/Tổng tiền phiếu/.test(requestText),
	'FE-29 phiếu của nhân viên không hiện tổng tiền',
	requestText.match(/Tổng tiền phiếu[^.]*/)?.[0] ?? '',
);
console.log('ảnh:', await shot(a1, 'fe-29-no-price'));
void pickerText;

// ─── FE-24: đổi hạn chót sớm hơn ──────────────────────────────────────────────
await go(hr, `/management/office/supply-periods/${mainPeriodId}`);
await clearToasts(hr);
await hr.getByRole('button', { name: 'Đổi hạn chót' }).first().click();
await hr.waitForTimeout(800);
const deadlineInput = hr.locator('input[placeholder="dd/mm/yyyy"]').first();
await deadlineInput.fill(viDate(daysFromNow(2)));
await deadlineInput.press('Enter');
await hr.waitForTimeout(400);
await hr.getByRole('button', { name: 'Lưu hạn chót' }).click();
const deadlineToast = await toastText(hr, 20000);
line(
	/Đã đổi hạn chót thành ngày/.test(deadlineToast),
	'FE-24 đổi hạn chót sang ngày sớm hơn',
	deadlineToast,
);
await hr.waitForTimeout(2000);
console.log('ảnh:', await shot(hr, 'fe-24-deadline-changed'));

const a1Token = await apiToken(WHO.employeeA1.email);
const a1Notifs = await api(a1Token, '/v1/notifications?page=1&limit=10');
const changed = (a1Notifs.json?.data ?? []).find(n => n.type === 'OFFICE_SUPPLY_PERIOD_CHANGED');
line(
	!!changed,
	'FE-24 nhân viên nhận thông báo đổi hạn chót',
	changed ? `${changed.title} — ${changed.message ?? changed.body ?? ''}`.slice(0, 160) : '',
);

await go(a1, '/office/supplies');
await a1.waitForTimeout(2500);
await a1.locator('button', { hasText: monthOption(MONTH_MAIN) }).filter({ hasText: site.name }).first().click();
await a1.waitForTimeout(2500);
const countdownText = await text(a1);
line(
	/Còn \d+ ngày|Còn \d+ giờ/.test(countdownText),
	'FE-24 đếm ngược trên phiếu chạy theo hạn mới',
	countdownText.match(/Hạn chót [^·]*· Còn [^A-Z]*/)?.[0]?.trim() ?? '',
);
console.log('ảnh:', await shot(a1, 'fe-24-countdown'));

// ─── FE-25: khoá sớm ──────────────────────────────────────────────────────────
await go(hr, `/management/office/supply-periods/${mainPeriodId}`);
await clearToasts(hr);
await hr.getByRole('button', { name: 'Khoá sớm' }).first().click();
// UAT đợt B: khoá sớm hỏi lại kèm hậu quả, nên bấm thêm một bước xác nhận.
await hr.waitForTimeout(1000);
await hr.getByRole('button', { name: 'Khoá kỳ ngay' }).first().click();
const lockToast = await toastText(hr, 20000);
line(/Đã khoá kỳ/.test(lockToast), 'FE-25 HR khoá sớm kỳ', lockToast);
await hr.waitForTimeout(2000);

const mgraToken = await apiToken(WHO.managerA.email);
const mgraNotifs = await api(mgraToken, '/v1/notifications?page=1&limit=10');
const lockNotif = (mgraNotifs.json?.data ?? []).find(n => n.type === 'OFFICE_SUPPLY_PERIOD_CHANGED');
line(
	!!lockNotif,
	'FE-25 trưởng phòng nhận thông báo khoá sớm',
	lockNotif ? `${lockNotif.title} — ${lockNotif.message ?? lockNotif.body ?? ''}`.slice(0, 160) : '',
);

const periodAfterLock = await api(hrToken, '/v1/office/supply-periods');
const locked = periodAfterLock.json?.data?.find(p => p.id === mainPeriodId);
const lockAtDiff = locked ? Math.abs(Date.now() - new Date(locked.lockAt).getTime()) / 60000 : 999;
line(lockAtDiff < 10, 'FE-25 lockAt thành giờ khoá thật, không còn là nửa đêm sau hạn chót', `lệch ${lockAtDiff.toFixed(1)} phút`);

await go(a1, '/office/supplies');
await a1.waitForTimeout(2500);
await a1.locator('button', { hasText: monthOption(MONTH_MAIN) }).filter({ hasText: site.name }).first().click();
await a1.waitForTimeout(2500);
const lockedText = await text(a1);
line(
	!/Còn \d+ ngày/.test(lockedText) && /Chờ HCNS chốt/.test(lockedText),
	'FE-25 phiếu dừng đếm ngược và chuyển sang chờ HCNS chốt',
	lockedText.match(/Hạn chót[^·]*·?[^A-Z]{0,30}/)?.[0]?.trim() ?? '',
);
console.log('ảnh:', await shot(a1, 'fe-25-locked'));

// ─── FE-26: chốt, cấp, sửa số, nhận, sửa số thực nhận, đóng kỳ ────────────────
await go(hr, `/management/office/supply-periods/${mainPeriodId}`);
await hr.locator('button', { hasText: 'Phiếu chính' }).first().click();
await hr.waitForTimeout(2500);
let reqBox = dialog(hr, 'Phiếu phòng');
await clearToasts(hr);
await reqBox.getByRole('button', { name: 'Chốt phiếu' }).click();
const finalizeToast = await toastText(hr, 20000);
line(/Đã chốt phiếu/.test(finalizeToast), 'FE-26 chốt phiếu giữ nguyên số xin', finalizeToast);
await hr.waitForTimeout(2000);
await clearToasts(hr);
await reqBox.getByRole('button', { name: 'Cấp hàng' }).click();
const issueToast = await toastText(hr, 20000);
line(/Đã cấp hàng/.test(issueToast), 'FE-26 cấp hàng', issueToast);
await hr.waitForTimeout(2500);

// Sửa số ở phiếu ĐÃ CẤP: thiếu lý do bị chặn.
const paperRow = reqBox.locator('tr', { hasText: 'Giấy in A4' }).first();
await paperRow.locator('input[role="spinbutton"]').first().fill('7');
await hr.waitForTimeout(400);
await clearToasts(hr);
await reqBox.getByRole('button', { name: 'Sửa số' }).click();
await hr.waitForTimeout(1500);
const refinalizeError = (await paperRow.locator('p.text-red-500').first().innerText().catch(() => '')).trim();
line(
	/ghi lý do/i.test(refinalizeError),
	'FE-26 sửa số phiếu đã cấp mà thiếu lý do thì bị chặn ngay ô đó',
	refinalizeError,
);
console.log('ảnh:', await shot(hr, 'fe-26-refinalize-no-reason'));

await paperRow.locator('input[type="text"]:not([role="spinbutton"])').first().fill('Kho chỉ còn 7 tập');
await hr.waitForTimeout(300);
await clearToasts(hr);
await reqBox.getByRole('button', { name: 'Sửa số' }).click();
const refinalizeToast = await toastText(hr, 20000);
line(/Đã sửa số của phiếu/.test(refinalizeToast), 'FE-26 có lý do thì sửa được số của phiếu đã cấp', refinalizeToast);
await hr.waitForTimeout(2500);
console.log('ảnh:', await shot(hr, 'fe-26-refinalized'));

await reqBox.getByRole('button', { name: 'Đóng', exact: true }).first().click();
await hr.waitForTimeout(1000);
const matrixAfterRefinalize = await text(hr);
line(
	/Kho chỉ còn 7 tập/.test(matrixAfterRefinalize),
	'FE-26 lý do sửa số hiện ở cột Ghi chú của bảng tổng hợp',
	matrixAfterRefinalize.match(/[^·]*Kho chỉ còn 7 tập/)?.[0]?.trim().slice(0, 80) ?? '',
);
console.log('ảnh:', await shot(hr, 'fe-26-notes-column'));

// Phòng nhận hàng (trưởng phòng A là người nhận mặc định).
const mgra = await signIn(browser, WHO.managerA.email);
await go(mgra, '/office/supplies');
await mgra.waitForTimeout(2500);
await mgra.locator('button', { hasText: monthOption(MONTH_MAIN) }).filter({ hasText: site.name }).first().click();
await mgra.waitForTimeout(2500);
await clearToasts(mgra);
await mgra.getByRole('button', { name: 'Đã nhận', exact: true }).first().click();
await mgra.waitForTimeout(2000);
const receiveBox = dialog(mgra, 'Xác nhận đã nhận hàng');
await receiveBox.getByRole('button', { name: 'Xác nhận đã nhận', exact: true }).click();
const receiveToast = await toastText(mgra, 20000);
line(/Đã ghi nhận hàng/.test(receiveToast), 'FE-26 phòng bấm đã nhận', receiveToast);
await mgra.waitForTimeout(2000);

// Sửa số thực nhận.
await go(hr, `/management/office/supply-periods/${mainPeriodId}`);
await hr.locator('button', { hasText: 'Phiếu chính' }).first().click();
await hr.waitForTimeout(2500);
reqBox = dialog(hr, 'Phiếu phòng');
await reqBox.getByRole('button', { name: 'Sửa số thực nhận' }).click();
await hr.waitForTimeout(1200);
const correctRow = reqBox.locator('tr', { hasText: 'Giấy in A4' }).first();
await correctRow.locator('input[role="spinbutton"]').first().fill('5');
await hr.waitForTimeout(300);
await clearToasts(hr);
await reqBox.getByRole('button', { name: 'Lưu số thực nhận' }).click();
await hr.waitForTimeout(1200);
const reasonError = (await reqBox.locator('p.text-red-500').first().innerText().catch(() => '')).trim();
line(/lý do/i.test(reasonError), 'FE-26 sửa số thực nhận mà thiếu lý do thì bị chặn', reasonError);
console.log('ảnh:', await shot(hr, 'fe-26-correct-no-reason'));

await reqBox.locator('input[placeholder*="gõ nhầm"]').first().fill('Phòng đếm lại chỉ có 5 tập');
await hr.waitForTimeout(300);
await clearToasts(hr);
await reqBox.getByRole('button', { name: 'Lưu số thực nhận' }).click();
const correctToast = await toastText(hr, 20000);
line(/Đã sửa số thực nhận/.test(correctToast), 'FE-26 có lý do thì sửa được số thực nhận', correctToast);
await hr.waitForTimeout(2500);
console.log('ảnh:', await shot(hr, 'fe-26-corrected'));
await reqBox.getByRole('button', { name: 'Đóng', exact: true }).first().click();
await hr.waitForTimeout(1000);

// Đóng kỳ rồi mọi nút sửa phải ẩn.
await clearToasts(hr);
await hr.getByRole('button', { name: 'Đóng kỳ', exact: true }).first().click();
// UAT đợt B: đóng kỳ nay hỏi lại vì đóng là chốt sổ chi phí, không sửa số được nữa.
await hr.waitForTimeout(1000);
await hr.getByRole('button', { name: 'Đóng kỳ này' }).first().click();
const closeToast = await toastText(hr, 20000);
line(/Đã đóng kỳ/.test(closeToast), 'FE-26 đóng kỳ khi mọi phiếu có dòng đã nhận', closeToast);
await hr.waitForTimeout(2500);
const closedButtons = await hr
	.getByRole('button', { name: /Khoá sớm|Đóng kỳ|Đổi hạn chót|Thêm phòng|Phiếu bổ sung|Lưu dự trù|Huỷ kỳ/ })
	.count();
line(closedButtons === 0, 'FE-26 kỳ đã đóng thì không còn nút ghi nào trên trang kỳ', `${closedButtons} nút`);
await hr.locator('button', { hasText: 'Phiếu chính' }).first().click();
await hr.waitForTimeout(2000);
const closedBox = dialog(hr, 'Phiếu phòng');
const closedEditButtons = await closedBox.getByRole('button', { name: /Sửa số|Chốt phiếu|Cấp hàng|Ghi đã giao/ }).count();
line(closedEditButtons === 0, 'FE-26 kỳ đã đóng thì phiếu cũng không còn nút sửa', `${closedEditButtons} nút`);
console.log('ảnh:', await shot(hr, 'fe-26-closed-period'));
await closedBox.getByRole('button', { name: 'Đóng', exact: true }).first().click();
await hr.waitForTimeout(800);

// ─── FE-28: lấy số tháng trước ────────────────────────────────────────────────
let nextPeriodId = await periodIdOfMonth(MONTH_NEXT);
if (!nextPeriodId) {
	const created = await createPeriod({ month: monthOption(MONTH_NEXT), deadlineDays: 8, departments: ['Tài chính - Kế toán'] });
	line(/Đã mở kỳ/.test(created), `FE-28 mở kỳ ${monthOption(MONTH_NEXT)} để thử lấy số tháng trước`, created);
	nextPeriodId = await periodIdOfMonth(MONTH_NEXT);
}

await go(a1, '/office/supplies');
await a1.waitForTimeout(2500);
await a1.locator('button', { hasText: monthOption(MONTH_NEXT) }).filter({ hasText: site.name }).first().click();
await a1.waitForTimeout(2500);
await clearToasts(a1);
await a1.getByRole('button', { name: 'Lấy số tháng trước' }).first().click();
const copyToast = await toastText(a1, 20000);
line(/Đã thêm \d+ dòng từ Tháng \d+\/\d+/.test(copyToast), 'FE-28 toast nêu số dòng và tên kỳ trước', copyToast);
line(
	/Bỏ qua \d+ dòng:/.test(copyToast) && /vượt định mức/.test(copyToast),
	'FE-28 toast liệt kê từng dòng bỏ qua kèm lý do',
	copyToast,
);
await a1.waitForTimeout(2000);
const copiedText = await text(a1);
line(
	/dòng của kỳ trước chưa được thêm/.test(copiedText),
	'FE-28 danh sách dòng bỏ qua ở lại trên màn sau khi toast tắt',
	copiedText.match(/\d+ dòng của kỳ trước[^:]*:/)?.[0] ?? '',
);
line(/Pin 3A/.test(copiedText), 'FE-28 dòng ngoài danh mục của kỳ trước cũng được chép');
console.log('ảnh:', await shot(a1, 'fe-28-copy-previous'));

for (const [name, page] of [
	['HR01', hr],
	['EMPA1', a1],
	['MGRA', mgra],
]) {
	line(page.errors.length === 0, `FE-23..FE-29 không có lỗi JavaScript (${name})`, page.errors.slice(0, 2).join(' | '));
	console.log(`response 4xx của ${name}:`, [...new Set(page.apiErrors)].join(' | ') || 'không có');
}

await browser.close();
process.exit(summary() ? 1 : 0);
