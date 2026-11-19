/**
 * S1, FE-54, FE-53, FE-36: những màn hình khi CHƯA có dữ liệu, và dấu hỏi mô tả trang trên điện
 * thoại.
 *
 * Phần "chưa có văn phòng nào" chạy trên một công ty riêng ĐANG TRẮNG (`companies.nos` của sandbox,
 * đã bật OFFICE nhưng chưa có văn phòng). Trước đây bài dùng công ty chính nên chỉ chạy được ngay
 * sau khi dựng lại sandbox: các bài khác tạo văn phòng là màn hình rỗng không dựng lại được, mà
 * API không có đường xoá văn phòng.
 *
 * Bài KHÔNG tạo văn phòng ở công ty trắng đó, để lần sau vẫn kiểm được; đường tạo văn phòng đầu
 * tiên đã có `smoke-places.mjs` lo.
 */
import { PASSWORD, SANDBOX, WHO, api, dialog, go, launch, line, shot, signIn, summary, text } from './helper.mjs';

/** Công ty đã bật OFFICE mà chưa có văn phòng nào; `null` nghĩa là sandbox không còn công ty nào trắng. */
async function findEmptyCompanyHr() {
	for (const [code, company] of Object.entries(SANDBOX.companies ?? {})) {
		if (!company?.hr) continue;
		const res = await fetch(`${SANDBOX.api ?? 'http://localhost:3190'}/v1/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: company.hr, password: PASSWORD }),
		});
		const token = (await res.json())?.data?.accessToken;
		if (!token) continue;
		const sites = await api(token, '/v1/office/sites');
		if (sites.status === 200 && (sites.json?.data ?? []).length === 0) {
			console.log(`công ty trắng: ${code} (${company.hr})`);
			return company.hr;
		}
	}
	return null;
}

const emptyHrEmail = await findEmptyCompanyHr();
const browser = await launch();

if (!emptyHrEmail) {
	line(false, 'S1/FE-54 cần một công ty đã bật OFFICE mà chưa có văn phòng', 'sandbox không còn công ty nào trắng');
} else {

// ─── S1: trang Cài đặt hành chính của công ty chưa có văn phòng ───────────────
const hr = await signIn(browser, emptyHrEmail);
await go(hr, '/management/office/settings', 4500);
const settingsText = (await text(hr)).replace(/\s+/g, ' ');
line(
	settingsText.includes('Công ty chưa có văn phòng nào.'),
	'S1 trang Cài đặt nói rõ công ty chưa có văn phòng nào',
	settingsText.match(/Công ty chưa có văn phòng nào\./)?.[0] ?? settingsText.slice(0, 200),
);
line(
	settingsText.includes('Văn phòng là toà nhà hay địa điểm làm việc của công ty') &&
		settingsText.includes('Phòng họp nằm trong một văn phòng'),
	'S1 câu dẫn nói văn phòng là gì và phòng họp nằm ở đâu',
	settingsText.match(/Văn phòng là toà nhà[^.]*\./)?.[0] ?? '',
);
const firstSiteButton = hr.getByRole('button', { name: 'Thêm văn phòng đầu tiên' });
line((await firstSiteButton.count()) > 0, 'S1 có nút "Thêm văn phòng đầu tiên"');
console.log('ảnh:', await shot(hr, 's1-settings-no-site'));

// Bấm nút: HỘP THOẠI thêm văn phòng phải mở ngay, kèm hai câu nhắc về địa chỉ và tầng, số phòng.
await firstSiteButton.click();
await hr.waitForTimeout(1200);
const siteModal = dialog(hr, 'Thêm văn phòng');
const openedForm = (await siteModal.innerText()).replace(/\s+/g, ' ');
line((await siteModal.count()) > 0, 'S1 bấm nút thì hộp thoại thêm văn phòng mở ra');
line(
	(await siteModal.locator('input[placeholder*="Văn phòng Hữu Nghị"]').count()) > 0,
	'S1 hộp thoại có ô Tên văn phòng',
);
line(
	openedForm.includes('Tầng, số phòng là phòng họp: bạn thêm vào văn phòng ở bước sau'),
	'S1 form nhắc trước rằng tầng và số phòng là phòng họp',
	openedForm.match(/Tầng, số phòng[^.]*\./)?.[0] ?? '',
);
line(
	(await siteModal.locator('input[placeholder*="Lý Thường Kiệt"]').count()) > 0,
	'S1 ô Địa chỉ lấy ví dụ là địa chỉ phố',
);
// Đóng lại và KHÔNG lưu: công ty này phải còn trắng cho lần chạy sau.
await siteModal.getByRole('button', { name: 'Đóng', exact: true }).click();
await hr.waitForTimeout(600);
line((await dialog(hr, 'Thêm văn phòng').count()) === 0, 'S1 nút Đóng đóng được hộp thoại');
console.log('ảnh:', await shot(hr, 's1-settings-form-open'));

// ─── FE-54: trang Kỳ và trang Đặt phòng của công ty chưa có văn phòng ─────────
await go(hr, '/management/office/supply-periods');
const periodsText = await text(hr);
line(
	periodsText.includes('Công ty chưa có văn phòng nào nên chưa mở kỳ đăng ký được'),
	'FE-54 trang Kỳ nói rõ việc đầu tiên là tạo văn phòng',
	periodsText.match(/Công ty chưa có[^.]*\./)?.[0] ?? periodsText.slice(0, 160),
);
line(
	periodsText.includes('Bạn tạo văn phòng ở Cài đặt hành chính'),
	'FE-54 HCNS được chỉ tới Cài đặt hành chính, không bị bảo "liên hệ HCNS"',
	periodsText.match(/Bạn tạo văn phòng[^,]*/)?.[0] ?? '',
);
line(
	!periodsText.includes('Bạn bấm Mở kỳ mới'),
	'FE-54 không còn câu "bấm Mở kỳ mới" khi nút đó không hiện',
	periodsText.includes('Bạn bấm Mở kỳ mới') ? 'vẫn còn câu cũ' : 'đã bỏ',
);
const settingsLink = hr.locator('a[href="/management/office/settings"]').first();
line(await settingsLink.count() > 0, 'FE-54 câu chỉ đường có liên kết bấm được tới Cài đặt hành chính');
console.log('ảnh:', await shot(hr, 'fe-54-periods-no-site'));

await go(hr, '/office/rooms');
const roomsText = await text(hr);
line(
	roomsText.includes('Công ty chưa có văn phòng nào, nên chưa có phòng họp để đặt'),
	'FE-54 trang Đặt phòng cũng nói chưa có văn phòng',
	roomsText.match(/Công ty chưa có[^.]*\./)?.[0] ?? '',
);
line(
	roomsText.includes('Bạn tạo văn phòng và phòng họp ở Cài đặt hành chính'),
	'FE-54 trang Đặt phòng chỉ tới Cài đặt hành chính cho người có quyền',
	roomsText.includes('liên hệ HCNS') ? 'vẫn bảo liên hệ HCNS' : 'đã chỉ đường',
);
console.log('ảnh:', await shot(hr, 'fe-54-rooms-no-site'));

// Nút "Đặt phòng" cũng không hiện khi chưa có phòng nào.
line(
	(await hr.getByRole('button', { name: 'Đặt phòng', exact: true }).count()) === 0,
	'FE-54 không bày nút Đặt phòng khi chưa có phòng họp nào',
);

}

// ─── FE-53: giám đốc không thuộc phòng ban nào ────────────────────────────────
const director = await signIn(browser, WHO.director.email);
await go(director, '/office/supplies');
const dirText = await text(director);
line(
	dirText.includes('Bạn chưa thuộc phòng ban nào nên không có phiếu văn phòng phẩm'),
	'FE-53 người không thuộc phòng ban nhận câu đúng, không bị hẹn chờ HCNS mở kỳ',
	dirText.match(/Bạn chưa thuộc[^.]*\./)?.[0] ?? dirText.slice(0, 200),
);
line(
	!dirText.includes('Khi HCNS mở kỳ, bạn sẽ nhận thông báo'),
	'FE-53 không còn lời hứa "khi HCNS mở kỳ" với người không có phòng',
);
console.log('ảnh:', await shot(director, 'fe-53-no-department'));

// ─── FE-36: dấu hỏi mô tả trang, chạm trên điện thoại ─────────────────────────
const phone = await signIn(browser, WHO.hr.email, { phone: true });
for (const [name, path] of [
	['office', '/office/supplies'],
	['nghi-phep', '/management/leave'],
	['cham-cong', '/management/attendance'],
]) {
	await go(phone, path, 3500);
	const tip = phone.locator('[role="tooltip"]');
	const button = phone.locator('button[aria-label^="Trang này dùng để làm gì"]').first();
	line((await button.count()) > 0, `FE-36 trang ${name} có dấu hỏi cạnh tiêu đề`);
	await button.tap();
	await phone.waitForTimeout(900);
	const openedAfterTap = await tip.first().isVisible().catch(() => false);
	line(openedAfterTap, `FE-36 chạm dấu hỏi ở ${name} thì hộp mở và GIỮ nguyên`, `hiện: ${openedAfterTap}`);
	if (openedAfterTap) console.log('ảnh:', await shot(phone, `fe-36-tooltip-${name}`));

	// Chạm ra ngoài thì đóng.
	await phone.locator('body').tap({ position: { x: 20, y: 700 } });
	await phone.waitForTimeout(600);
	line(
		!(await tip.first().isVisible().catch(() => false)),
		`FE-36 chạm ra ngoài ở ${name} thì hộp đóng`,
	);

	// Chạm lần nữa mở lại, chạm lại lần nữa thì đóng (bật tắt bằng ngón tay).
	await button.tap();
	await phone.waitForTimeout(600);
	const reopened = await tip.first().isVisible().catch(() => false);
	await button.tap();
	await phone.waitForTimeout(600);
	const closedAgain = !(await tip.first().isVisible().catch(() => false));
	line(reopened && closedAgain, `FE-36 chạm lần nữa ở ${name} thì bật tắt đúng`, `mở lại ${reopened}, đóng ${closedAgain}`);
}

// Desktop: rê chuột vẫn mở như trước. Dùng HCNS của công ty chính, vì trang Nghỉ phép cần dữ liệu.
const mainHr = await signIn(browser, WHO.hr.email);
await go(mainHr, '/management/leave', 3500);
const hrButton = mainHr.locator('button[aria-label^="Trang này dùng để làm gì"]').first();
await hrButton.hover();
await mainHr.waitForTimeout(600);
line(
	await mainHr.locator('[role="tooltip"]').first().isVisible().catch(() => false),
	'FE-36 desktop rê chuột vẫn mở hộp mô tả',
);
console.log('ảnh:', await shot(mainHr, 'fe-36-tooltip-desktop'));

for (const [name, page] of [
	['HCNS', mainHr],
	['giám đốc', director],
	['điện thoại', phone],
]) {
	line(page.errors.length === 0, `FE-53/FE-54/FE-36 không có lỗi JavaScript (${name})`, page.errors.slice(0, 2).join(' | '));
}

await browser.close();
process.exit(summary() ? 1 : 0);
