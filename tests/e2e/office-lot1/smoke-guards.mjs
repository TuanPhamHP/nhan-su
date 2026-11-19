/**
 * FE-19, FE-20: chặn truy cập.
 *
 * FE-19: nhân viên thường gõ thẳng đường dẫn khu quản trị.
 * FE-20: công ty chưa được cấp module OFFICE — ô phân hệ khoá, hộp thoại theo `lockReason`, và
 * route bị chặn thay vì trắng trang.
 */
import { OGO, WHO, go, launch, line, shot, signIn, summary, text, toastText } from './helper.mjs';

const browser = await launch();

// ─── FE-19: nhân viên vào khu quản trị ────────────────────────────────────────
const emp = await signIn(browser, WHO.employeeA1.email);
const MANAGEMENT_PATHS = [
	'/management/office/supply-periods',
	'/management/office/reports',
	'/management/office/settings',
];

for (const path of MANAGEMENT_PATHS) {
	await go(emp, path, 3500);
	const url = emp.url();
	const body = await text(emp);
	line(
		!url.includes('/management/'),
		`FE-19 nhân viên vào ${path} thì bị đưa ra khỏi khu quản trị`,
		`đang ở ${url}`,
	);
	line(body.length > 200, `FE-19 ${path} không trắng trang`, `${body.length} ký tự`);
}
console.log('ảnh:', await shot(emp, 'fe-19-employee-blocked'));

// ─── FE-20: công ty chưa được cấp OFFICE ──────────────────────────────────────
const ogo = await signIn(browser, OGO.hr);
await go(ogo, '/management', 4000);
await ogo.locator('[data-testid="app-launcher-button"]').click();
await ogo.waitForTimeout(1500);
const launcherText = await text(ogo);
line(/Hành chính văn phòng/.test(launcherText), 'FE-20 lưới vẫn hiện ô Hành chính văn phòng', '');
line(
	/Chưa đăng ký|chưa được mở|Chưa mua/i.test(launcherText),
	'FE-20 ô ở trạng thái khoá kèm nhãn vì sao',
	launcherText.match(/Chưa đăng ký|chưa được mở|Chưa mua/i)?.[0] ?? '',
);
console.log('ảnh:', await shot(ogo, 'fe-20-locked-tile'));

// Ô khoá trong lưới mang `data-locked-app`; nút cùng tên ở thanh bên nằm dưới lớp phủ nên không
// bấm được, và cũng không phải thứ bài này muốn thử.
const lockedTile = ogo.locator('[data-locked-app="adm"]').first();
line(await lockedTile.count() > 0, 'FE-20 ô Hành chính văn phòng ở nhóm ô khoá của lưới');
await lockedTile.click();
await ogo.waitForTimeout(1500);
const dialogText = await text(ogo);
line(
	/chưa được mở|liên hệ|hotline|\d{4}/i.test(dialogText),
	'FE-20 bấm ô khoá thì mở hộp thoại nói vì sao và liên hệ ai',
	dialogText.match(/(Hành chính văn phòng[^.]{0,120})/)?.[0] ?? '',
);
console.log('ảnh:', await shot(ogo, 'fe-20-locked-dialog'));

for (const path of ['/office/rooms', '/office/supplies', '/management/office/supply-periods']) {
	await go(ogo, path, 3500);
	const toast = await toastText(ogo, 6000);
	const body = await text(ogo);
	line(
		!ogo.url().includes(path),
		`FE-20 gõ thẳng ${path} thì bị chặn`,
		`đang ở ${ogo.url()} — ${toast}`,
	);
	line(body.length > 200, `FE-20 ${path} không trắng trang`, `${body.length} ký tự`);
}
console.log('ảnh:', await shot(ogo, 'fe-20-route-blocked'));

for (const [name, page] of [
	['EMPA1', emp],
	['HR công ty ogo', ogo],
]) {
	line(page.errors.length === 0, `FE-19/FE-20 không có lỗi JavaScript (${name})`, page.errors.slice(0, 2).join(' | '));
	console.log(`response 4xx của ${name}:`, [...new Set(page.apiErrors)].join(' | ') || 'không có');
}

await browser.close();
process.exit(summary() ? 1 : 0);
