/**
 * FE-01, FE-02, FE-03: lưới phân hệ, cài đặt hành chính (văn phòng, nhập danh mục HCNS, định mức,
 * phòng họp).
 *
 * Bài này dựng dữ liệu nền cho mọi bài sau, nên chạy đầu tiên.
 */
import {
	HCNS_FILE,
	WHO,
	clearToasts,
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
} from './helper.mjs';

const browser = await launch();
const page = await signIn(browser, WHO.hr.email);

// ─── FE-01: lưới phân hệ và menu ──────────────────────────────────────────────
await go(page, '/management');
await page.locator('[data-testid="app-launcher-button"]').click();
await page.waitForTimeout(1200);
const launcher = await text(page);
line(
	launcher.includes('Hành chính văn phòng'),
	'FE-01 lưới phân hệ có ô Hành chính văn phòng',
	launcher.includes('Hành chính văn phòng') ? '' : launcher.slice(0, 300),
);
// Tên nhóm hiện chữ in hoa bằng CSS, nên so không phân biệt hoa thường.
line(
	launcher.toLowerCase().includes('hành chính & vận hành'),
	'FE-01 ô nằm trong nhóm Hành chính & Vận hành',
);
const lockedTile = await page
	.locator('button', { hasText: 'Hành chính văn phòng' })
	.first()
	.getAttribute('title');
line(!String(lockedTile ?? '').includes('khoá'), 'FE-01 ô không ở trạng thái khoá', String(lockedTile ?? ''));
console.log('ảnh:', await shot(page, 'fe-01-launcher'));

// Vào phân hệ rồi đọc menu bên trái.
await page.locator('button', { hasText: 'Hành chính văn phòng' }).first().click();
await page.waitForTimeout(2500);
const sidebar = await text(page);
// UAT đợt B: mục menu đổi tên thành "Chi phí văn phòng phẩm" cho khớp tiêu đề trang và file Excel.
const MENU = [
	'Kỳ văn phòng phẩm',
	'Chi phí văn phòng phẩm',
	'Cài đặt hành chính',
	'Văn phòng phẩm',
	'Đặt phòng họp',
];
const missing = MENU.filter(label => !sidebar.includes(label));
line(missing.length === 0, 'FE-01 menu đủ 5 mục', missing.length ? `thiếu: ${missing.join(', ')}` : '');
console.log('ảnh:', await shot(page, 'fe-01-menu'));

// ─── FE-02: văn phòng và nhập danh mục ────────────────────────────────────────
await go(page, '/management/office/settings');

/**
 * Thêm một văn phòng, bỏ qua nếu lần chạy trước đã tạo.
 *
 * Sandbox giữ dữ liệu giữa các lần chạy bài, nên bước dựng dữ liệu phải chạy lại được mà không
 * biến thành bài thử trùng tên (trùng tên đã có bài riêng ở phần phòng họp).
 */
async function addSite(name, address) {
	await clearToasts(page);
	// Văn phòng nay hiện thành THẺ (tiêu đề h3), không còn là hàng của bảng.
	if ((await page.locator('h3', { hasText: name }).count()) > 0) return 'đã có từ lần chạy trước';
	await page.getByRole('button', { name: 'Thêm văn phòng' }).first().click();
	await page.waitForTimeout(800);
	// Form văn phòng nay nằm trong hộp thoại.
	const modal = dialog(page, 'Thêm văn phòng');
	await modal.locator('input[placeholder*="Văn phòng Hữu Nghị"]').first().fill(name);
	await modal.locator('input[placeholder*="Lý Thường Kiệt"]').first().fill(address);
	await modal.getByRole('button', { name: 'Lưu', exact: true }).click();
	return toastText(page);
}

const site1 = await addSite('Văn phòng Hữu Nghị', 'Tầng 3, 12 Hữu Nghị, Hà Nội');
line(/Đã lưu văn phòng Văn phòng Hữu Nghị|đã có/.test(site1), 'FE-02 tạo văn phòng Hữu Nghị', site1);
const site2 = await addSite('Văn phòng Lạng Sơn', 'Lạng Sơn');
line(/Đã lưu văn phòng Văn phòng Lạng Sơn|đã có/.test(site2), 'FE-02 tạo văn phòng Lạng Sơn', site2);
console.log('ảnh:', await shot(page, 'fe-02-sites'));

// Nhập file đăng ký hằng tháng của HCNS.
await clearToasts(page);
await page.getByRole('button', { name: 'Văn phòng phẩm', exact: true }).first().click();
await page.waitForTimeout(1500);
await page.locator('input[type="file"]').first().setInputFiles(HCNS_FILE);
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Nhập danh mục' }).first().click();
const importToast = await toastText(page, 30000);
await page.waitForTimeout(2500);
const afterImport = await text(page);
const importReport = afterImport.match(/Thêm \d+ mặt hàng, \d+ nhóm mới[^.]*/)?.[0] ?? '';
line(/Đã nhập xong/.test(importToast), 'FE-02 nhập file HCNS chạy xong', importToast);
// Lần chạy lại thì danh mục đã có sẵn, nên nhận cả câu "0 mặt hàng mới, 59 đã có từ trước".
line(
	/Thêm 59 mặt hàng, 5 nhóm mới/.test(importReport) || /59 mặt hàng đã có từ trước/.test(importReport),
	'FE-02 báo đúng 5 nhóm và 59 mặt hàng',
	importReport,
);
console.log('ảnh:', await shot(page, 'fe-02-import'));

for (const group of ['Đồ uống', 'Khác', 'Vật dụng sử dụng vệ sinh']) {
	const row = page.locator('tr', { hasText: group }).first();
	const badge = await row.locator('[data-testid="hr-only-badge"]').count();
	line(badge > 0, `FE-02 nhóm ${group} có nhãn "Chỉ HCNS đặt"`, badge > 0 ? '' : 'không thấy nhãn');
}
console.log('ảnh:', await shot(page, 'fe-02-groups'));

// Nhập lại cùng file: không mặt hàng nào mới.
await clearToasts(page);
await page.locator('input[type="file"]').first().setInputFiles(HCNS_FILE);
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Nhập danh mục' }).first().click();
const reimportToast = await toastText(page, 30000);
await page.waitForTimeout(2000);
const afterReimport = await text(page);
line(
	/Thêm 0 mặt hàng, 0 nhóm mới/.test(afterReimport),
	'FE-02 nhập lại cùng file báo 0 mặt hàng mới',
	`${reimportToast} | ${afterReimport.match(/Thêm \d+ mặt hàng, \d+ nhóm mới[^.]*/)?.[0] ?? ''}`,
);
console.log('ảnh:', await shot(page, 'fe-02-reimport'));

// ─── FE-03: định mức và phòng họp ─────────────────────────────────────────────
await clearToasts(page);
await page.getByRole('button', { name: 'Định mức theo phòng' }).first().click();
await page.waitForTimeout(1500);
// Ô chọn phòng ban là `UiSelectInput` đầu tiên của thẻ này.
await pickSearchable(page, page, 0, 'Tài chính', 'Tài chính - Kế toán');
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Thêm dòng' }).first().click();
await page.waitForTimeout(500);
// Dòng định mức vừa thêm: ô chọn mặt hàng là `UiSelectInput` thứ hai trên màn.
await pickSearchable(page, page, 1, 'Giấy in A4', 'Giấy in A4');
const qtyInput = page.locator('input[role="spinbutton"]').first();
await qtyInput.fill('5');
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Lưu định mức' }).first().click();
const quotaToast = await toastText(page);
line(/Đã lưu \d+ định mức/.test(quotaToast), 'FE-03 lưu định mức Giấy in A4 = 5 cho phòng Tài chính - Kế toán', quotaToast);
console.log('ảnh:', await shot(page, 'fe-03-quota'));

await clearToasts(page);
// Phần nhập danh mục ở trên đã chuyển sang thẻ "Văn phòng phẩm", nên quay lại thẻ gộp để thấy các
// thẻ văn phòng.
await page.getByRole('button', { name: 'Văn phòng và phòng họp', exact: true }).first().click();
await page.waitForTimeout(1500);

/**
 * Thêm phòng họp NGAY TRONG thẻ của văn phòng.
 *
 * Từ lần gộp hai thẻ, không còn thẻ "Phòng họp" riêng và form không còn ô chọn văn phòng: bấm
 * "Thêm phòng họp" ở thẻ nào thì phòng thuộc văn phòng đó.
 */
const huuNghiCard = page
	.locator('section')
	.filter({ has: page.locator('h3', { hasText: 'Văn phòng Hữu Nghị' }) })
	.first();

async function addRoom(name, capacity, { skipIfExists = true } = {}) {
	await clearToasts(page);
	if (skipIfExists && (await huuNghiCard.locator('p', { hasText: name }).count()) > 0) {
		return 'đã có từ lần chạy trước';
	}
	const addButton = huuNghiCard.getByRole('button', { name: 'Thêm phòng họp' });
	if (await addButton.count()) {
		await addButton.click();
		await page.waitForTimeout(800);
	}
	await huuNghiCard.locator('input[placeholder*="Phòng họp tầng 3"]').first().fill(name);
	await huuNghiCard.locator('input[role="spinbutton"]').first().fill(String(capacity));
	await huuNghiCard.getByRole('button', { name: /^Lưu/ }).first().click();
	return toastText(page);
}

const room1 = await addRoom('Phòng họp tầng 3', 12);
line(/Đã lưu phòng họp Phòng họp tầng 3|đã có/.test(room1), 'FE-03 tạo phòng họp tầng 3', room1);
const room2 = await addRoom('Phòng họp tầng 5', 6);
line(/Đã lưu phòng họp Phòng họp tầng 5|đã có/.test(room2), 'FE-03 tạo phòng họp tầng 5', room2);
console.log('ảnh:', await shot(page, 'fe-03-rooms'));

// Trùng tên phòng trong cùng văn phòng: lỗi phải nằm ở ô tên.
await clearToasts(page);
const dup = await addRoom('Phòng họp tầng 3', 8, { skipIfExists: false });
await page.waitForTimeout(800);
const dupError = await huuNghiCard.locator('p.text-red-500').first().innerText().catch(() => '');
line(
	dupError.trim().length > 0,
	'FE-03 trùng tên phòng báo lỗi ngay ô tên',
	dupError.trim() || `toast: ${dup}`,
);
console.log('ảnh:', await shot(page, 'fe-03-room-duplicate'));

line(page.errors.length === 0, 'FE-01..FE-03 không có lỗi JavaScript trên console', page.errors.slice(0, 3).join(' | '));
console.log('response 4xx đã gặp:', [...new Set(page.apiErrors)].join(' | ') || 'không có');

await browser.close();
process.exit(summary() ? 1 : 0);
