/**
 * FE-04: HR mở kỳ đăng ký cho ba phòng, thử mở trùng tháng và thử hạn chót đã qua.
 *
 * Chạy sau `smoke-settings.mjs` vì mở kỳ cần có văn phòng và danh mục.
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
	selectAt,
	shot,
	signIn,
	summary,
	text,
	toastText,
	viDate,
} from './helper.mjs';

/**
 * Tháng còn trống để bài tự mở kỳ của mình.
 *
 * Sandbox giữ kỳ của những lần chạy trước, mà một văn phòng chỉ có một kỳ cho mỗi tháng, nên bài
 * phải tự tìm tháng trống thay vì cắm cứng — nếu không, lần chạy thứ hai chỉ toàn lỗi trùng tháng.
 */
const hrToken = await apiToken(WHO.hr.email);
const existing = await api(hrToken, '/v1/office/supply-periods');
const allSites = ((await api(hrToken, '/v1/office/sites')).json?.data ?? []).filter(s => s.isActive);
if (!allSites.length) throw new Error('chưa có văn phòng nào — chạy smoke-settings.mjs trước');

// Tháng trống tính THEO TỪNG VĂN PHÒNG: một văn phòng chỉ có một kỳ mỗi tháng, nhưng hai văn
// phòng khác nhau có kỳ cùng tháng là chuyện bình thường. Hết tháng ở văn phòng này thì sang văn
// phòng khác, nhờ vậy bài chạy lại được trên sandbox đã có sẵn hàng chục kỳ.
const now = new Date();
let SITE_LABEL = null;
let freeMonth = null;
for (const site of allSites) {
	const taken = new Set(
		(existing.json?.data ?? []).filter(p => p.officeSite.id === site.id).map(p => p.month),
	);
	for (let offset = 1; offset <= 12 && !freeMonth; offset++) {
		const at = new Date(now.getFullYear(), now.getMonth() + offset, 1);
		const month = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
		if (!taken.has(month)) {
			freeMonth = month;
			SITE_LABEL = site.name;
		}
	}
	if (freeMonth) break;
}
if (!freeMonth) throw new Error('không còn văn phòng nào có tháng trống trong một năm tới');
const MONTH_LABEL = `Tháng ${Number(freeMonth.split('-')[1])}/${freeMonth.split('-')[0]}`;
console.log(`bài dùng kỳ ${MONTH_LABEL} ở ${SITE_LABEL}`);

const browser = await launch();
const page = await signIn(browser, WHO.hr.email);

await go(page, '/management/office/supply-periods');
console.log('ảnh:', await shot(page, 'fe-04-periods-empty'));

/** Mở hộp "Mở kỳ mới" rồi điền văn phòng, tháng và hạn chót. */
async function openCreateDialog() {
	await clearToasts(page);
	await page.getByRole('button', { name: 'Mở kỳ mới' }).first().click();
	await page.waitForTimeout(1500);
	return dialog(page, 'Mở kỳ đăng ký văn phòng phẩm');
}

async function fillDeadline(box, dateText) {
	const input = box.locator('input[placeholder="dd/mm/yyyy"]').first();
	await input.fill(dateText);
	await input.press('Enter');
	await page.waitForTimeout(400);
}

// ─── Mở kỳ cho một tháng còn trống, hạn chót vài ngày tới ─────────────────────
let box = await openCreateDialog();
// Ô 0 là văn phòng, ô 1 là tháng: chọn đúng văn phòng còn tháng trống.
await selectAt(box, page, 0, SITE_LABEL);
await selectAt(box, page, 1, MONTH_LABEL);
const monthLabelText = MONTH_LABEL;
await fillDeadline(box, viDate(daysFromNow(4)));
// Tick đủ ba phòng để các bài sau có phiếu của phòng Tài chính - Kế toán.
for (const name of ['Tài chính - Kế toán', 'Dịch vụ khách hàng', 'Trung tâm công nghệ']) {
	await box.locator('label', { hasText: name }).first().locator('input[type="checkbox"]').check();
}
const chosen = await box.locator('input[type="checkbox"]:checked').count();
line(chosen >= 3, 'FE-04 hộp mở kỳ tick sẵn các phòng (mặc định như kỳ trước)', `${chosen} phòng được tick`);
console.log('ảnh:', await shot(page, 'fe-04-create-dialog'));
await box.getByRole('button', { name: 'Mở kỳ', exact: true }).click();
const created = await toastText(page, 20000);
line(/Đã mở kỳ .* cho \d+ phòng/.test(created), 'FE-04 mở kỳ thành công', created);
await page.waitForTimeout(2000);
const listText = await text(page);
line(
	listText.includes(monthLabelText.trim()),
	'FE-04 kỳ vừa mở hiện ở danh sách',
	`${monthLabelText.trim()} | ${listText.slice(0, 200)}`,
);
line(/\d+ \/ \d+ phòng đã nhập/.test(listText), 'FE-04 danh sách hiện số phòng đã nhập', listText.match(/\d+ \/ \d+ phòng đã nhập/)?.[0] ?? '');
console.log('ảnh:', await shot(page, 'fe-04-periods-list'));

// ─── Mở trùng tháng cùng văn phòng ────────────────────────────────────────────
box = await openCreateDialog();
// Ô 0 là văn phòng, ô 1 là tháng: chọn đúng văn phòng còn tháng trống.
await selectAt(box, page, 0, SITE_LABEL);
await selectAt(box, page, 1, MONTH_LABEL);
await fillDeadline(box, viDate(daysFromNow(5)));
await box.getByRole('button', { name: 'Mở kỳ', exact: true }).click();
const duplicate = await toastText(page, 20000);
line(
	/đã có kỳ|PERIOD_EXISTS|đã mở kỳ/i.test(duplicate),
	'FE-04 mở trùng tháng bị chặn bằng câu của máy chủ',
	duplicate,
);
console.log('ảnh:', await shot(page, 'fe-04-duplicate-month'));

// ─── Hạn chót đã qua ──────────────────────────────────────────────────────────
// Vẫn trong hộp đang mở, chỉ đổi ngày: tháng nào cũng được vì lỗi chặn ở ô ngày trước đã.
await clearToasts(page);
await fillDeadline(box, viDate(daysFromNow(-3)));
await box.getByRole('button', { name: 'Mở kỳ', exact: true }).click();
await page.waitForTimeout(2500);
const dateError = await box.locator('p.text-xs.text-red-500, p.text-rose-600').first().innerText().catch(() => '');
const pastToast = await toastText(page, 3000);
line(
	dateError.trim().length > 0,
	'FE-04 hạn chót đã qua báo lỗi ngay ô ngày',
	dateError.trim() || `không thấy lỗi ở ô ngày, toast: ${pastToast}`,
);
console.log('ảnh:', await shot(page, 'fe-04-deadline-past'));

await box.getByRole('button', { name: 'Đóng' }).first().click();
await page.waitForTimeout(800);

line(page.errors.length === 0, 'FE-04 không có lỗi JavaScript trên console', page.errors.slice(0, 3).join(' | '));
console.log('response 4xx đã gặp:', [...new Set(page.apiErrors)].join(' | ') || 'không có');

await browser.close();
process.exit(summary() ? 1 : 0);
