/**
 * L-01 đến L-12 — phân hệ công ty chưa mua hiện ở trạng thái khoá.
 *
 * Bài bấm thật trên sandbox 3170 với web ở cổng 4021. Trạng thái module đổi bằng script của
 * session BE (`set-module-4a.cjs`), và bài trả sandbox về trạng thái ban đầu ở cuối: công ty
 * `cta` đã mua Tài sản, chưa mua Tuyển dụng.
 */
import {
	apiHotline,
	clean,
	go,
	launch,
	line,
	openLauncher,
	overflow,
	setModule,
	shot,
	signIn,
	summary,
	text,
	toastText,
	WHO,
} from './helper.mjs';

const browser = await launch();

/** Ô khoá trong lưới chọn phân hệ. */
function lockedCell(page, code) {
	return page.locator(`[data-locked-app="${code}"]`);
}

/**
 * Ô phân hệ dùng được trong lưới.
 *
 * Tìm theo mã app chứ không theo tên, vì ô khoá cũng là `button` mang đúng cái tên đó, nên tìm
 * theo tên thì không phân biệt được ô mở với ô khoá.
 */
function openCell(page, code) {
	return page.locator(`[data-app="${code}"]`);
}

const dialog = page => page.locator('[data-testid="module-locked-dialog"]');

// ════════════════════════ L-01, L-02, L-03: lưới của quản trị viên ════════════════════════
const admin = await signIn(browser, WHO.admin.email);
await go(admin, '/', 4000);
await openLauncher(admin);

line((await lockedCell(admin, 'rec').count()) === 1, 'L-01 lưới có ô Tuyển dụng ở trạng thái khoá');
const recCell = clean(await lockedCell(admin, 'rec').innerText());
line(/Chưa đăng ký/.test(recCell), 'L-01 ô khoá có nhãn Chưa đăng ký', recCell);
line((await lockedCell(admin, 'rec').locator('svg').count()) >= 2, 'L-01 ô khoá có hình ổ khoá bên cạnh tên');
line((await lockedCell(admin, 'ast').count()) === 0, 'L-01 Quản lý tài sản đã mua nên không bị khoá');
line((await openCell(admin, 'ast').count()) === 1, 'L-01 Quản lý tài sản vẫn là ô mở bình thường');
await shot(admin, 'L-01-luoi-co-o-khoa');

const urlBefore = admin.url();
await lockedCell(admin, 'rec').click();
await admin.waitForTimeout(900);
line((await dialog(admin).count()) === 1, 'L-02 bấm ô khoá thì mở hộp thoại');
const dialogText = clean(await dialog(admin).innerText());
line(
	dialogText.includes('Công ty bạn chưa đăng ký phân hệ Tuyển dụng.'),
	'L-02 hộp thoại nói đúng chuyện công ty chưa đăng ký',
	dialogText,
);
// Câu của quản trị viên đổi theo việc máy chủ có cấu hình hotline hay không (đợt 2), nên hỏi API
// rồi so với câu tương ứng. Ghi cứng một câu thì bài đỏ oan ở sandbox có đặt BUSINESS_HOTLINE.
const apiPhone = await apiHotline(WHO.admin.email);
line(
	dialogText.includes(
		apiPhone
			? `Liên hệ nhà cung cấp phần mềm qua hotline ${apiPhone} để đăng ký thêm phân hệ này.`
			: 'Liên hệ nhà cung cấp phần mềm để đăng ký thêm phân hệ này.',
	),
	`L-02 quản trị viên đọc câu liên hệ nhà cung cấp (${apiPhone ? 'có hotline' : 'không hotline'})`,
	dialogText,
);
line(dialogText.includes('Định biên'), 'L-02 hộp thoại kèm mô tả phân hệ', dialogText.slice(0, 200));
line(admin.url() === urlBefore, 'L-02 không chuyển trang', `${urlBefore} → ${admin.url()}`);
await shot(admin, 'L-02-hop-thoai-chua-dang-ky');

await admin.locator('[data-testid="module-locked-close"]').click();
await admin.waitForTimeout(600);
line((await dialog(admin).count()) === 0, 'L-02 nút Đóng đóng được hộp thoại');
await lockedCell(admin, 'rec').click();
await admin.waitForTimeout(700);
await admin.keyboard.press('Escape');
await admin.waitForTimeout(600);
line((await dialog(admin).count()) === 0, 'L-02 phím Esc cũng đóng hộp thoại');
line(
	(await admin.locator('input[placeholder="Tìm phân hệ hoặc màn hình…"]').count()) === 1,
	'L-02 một lần Esc chỉ đóng hộp thoại, lưới chọn phân hệ vẫn mở',
);

// L-03: tìm theo chữ trong mô tả phân hệ.
await admin.locator('input[placeholder="Tìm phân hệ hoặc màn hình…"]').fill('ứng viên');
await admin.waitForTimeout(900);
line((await lockedCell(admin, 'rec').count()) === 1, 'L-03 tìm "ứng viên" vẫn ra ô Tuyển dụng khoá');
await shot(admin, 'L-03-tim-kiem-ra-o-khoa');
await admin.keyboard.press('Escape');
await admin.waitForTimeout(500);

// ════════════════════════ L-05: danh sách phân hệ ở sidebar trang chủ ════════════════════════
await go(admin, '/', 4000);
// Người quản trị vào `/` thì middleware đưa sang trang chủ quản trị, nên so với URL đang có
// chứ không so với dấu gạch chéo.
const homeUrl = admin.url();
line(
	(await admin.locator('[data-locked-sidebar-app="rec"]').count()) === 1,
	'L-05 sidebar trang chủ có ô Tuyển dụng khoá',
);
await admin.locator('[data-locked-sidebar-app="rec"]').click();
await admin.waitForTimeout(900);
line((await dialog(admin).count()) === 1, 'L-05 bấm ô khoá ở sidebar mở cùng hộp thoại');
line(
	clean(await dialog(admin).innerText()).includes('Công ty bạn chưa đăng ký phân hệ Tuyển dụng.'),
	'L-05 hộp thoại ở sidebar nói đúng câu',
);
line(admin.url() === homeUrl, 'L-05 vẫn ở trang chủ, không chuyển trang', `${homeUrl} → ${admin.url()}`);
await shot(admin, 'L-05-sidebar-trang-chu');
await admin.keyboard.press('Escape');

// ════════════════════════ L-09: gõ thẳng URL khi chưa mua ════════════════════════
await go(admin, '/management/recruitment', 4500);
const guardToast = await toastText(admin, 8000);
line(/chưa được mở|hết hạn/i.test(guardToast), 'L-09 gõ thẳng URL thì vẫn có câu báo như cũ', guardToast);
line(!admin.url().includes('/management/recruitment'), 'L-09 bị chuyển khỏi màn tuyển dụng', admin.url());
await shot(admin, 'L-09-go-thang-url');

// ════════════════════════ L-08: nhân sự và nhân viên ════════════════════════
for (const [key, who, câu] of [
	['hr', WHO.hr, 'Bạn liên hệ quản trị viên của công ty nếu cần dùng phân hệ này.'],
	['kd1', WHO.kd1, 'Bạn liên hệ quản trị viên của công ty nếu cần dùng phân hệ này.'],
]) {
	const page = await signIn(browser, who.email);
	await go(page, '/', 4000);
	await openLauncher(page);
	line((await lockedCell(page, 'rec').count()) === 1, `L-08 ${key} thấy ô Tuyển dụng khoá`);
	await lockedCell(page, 'rec').click();
	await page.waitForTimeout(900);
	const txt = clean(await dialog(page).innerText());
	line(txt.includes(câu), `L-08 ${key} đọc câu liên hệ quản trị viên công ty`, txt);
	line(!txt.includes('nhà cung cấp'), `L-08 ${key} không đọc câu dành cho quản trị viên`);
	await shot(page, `L-08-${key}-hop-thoai`);
	await page.context().close();
}

// ════════════════════════ L-06: công ty chưa mua cả hai phân hệ ════════════════════════
const old = await signIn(browser, WHO.oldAdmin.email);
await go(old, '/', 4000);
await openLauncher(old);
line((await lockedCell(old, 'rec').count()) === 1, 'L-06 công ty old có ô Tuyển dụng khoá');
line((await lockedCell(old, 'ast').count()) === 1, 'L-06 công ty old có ô Quản lý tài sản khoá');
line((await openCell(old, 'ast').count()) === 0, 'L-06 không còn ô Quản lý tài sản mở ở công ty old');
await shot(old, 'L-06-cong-ty-chua-mua-ca-hai');
await old.context().close();

// ════════════════════════ L-11: không nạp được entitlements ════════════════════════
const blind = await signIn(browser, WHO.admin.email, {
	route: async page => {
		await page.route('**/v1/me/entitlements', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false}' }));
	},
});
await go(blind, '/', 4000);
await openLauncher(blind);
line((await blind.locator('[data-locked-app]').count()) === 0, 'L-11 không nạp được entitlements thì không ô nào bị khoá');
line((await openCell(blind, 'rec').count()) === 1, 'L-11 mọi ô mở như cũ, kể cả Tuyển dụng');
await shot(blind, 'L-11-khong-nap-duoc-entitlements');
await blind.context().close();

// ════════════════════════ L-10: điện thoại 390 px ════════════════════════
const phone = await signIn(browser, WHO.admin.email, { phone: true });
await go(phone, '/', 4000);
await openLauncher(phone);
let box = await overflow(phone);
line(box.scroll <= box.client + 2, 'L-10 lưới trên điện thoại không tràn ngang', JSON.stringify(box));
line((await lockedCell(phone, 'rec').count()) === 1, 'L-10 điện thoại vẫn thấy ô khoá');
await shot(phone, 'L-10-dien-thoai-luoi');
await lockedCell(phone, 'rec').click();
await phone.waitForTimeout(900);
box = await overflow(phone);
line(box.scroll <= box.client + 2, 'L-10 hộp thoại trên điện thoại không tràn ngang', JSON.stringify(box));
const closeBox = await phone.locator('[data-testid="module-locked-close"]').boundingBox();
line((closeBox?.height ?? 0) >= 36 && (closeBox?.width ?? 0) >= 60, 'L-10 nút Đóng đủ lớn để bấm', JSON.stringify(closeBox));
await shot(phone, 'L-10-dien-thoai-hop-thoai');
await phone.locator('[data-testid="module-locked-close"]').click();
await phone.waitForTimeout(500);
line((await dialog(phone).count()) === 0, 'L-10 bấm Đóng trên điện thoại đóng được hộp thoại');
await phone.context().close();

// ════════════════════════ L-04: ô khoá không vào "Gần đây" ════════════════════════
console.log('—', setModule('cta', 'RECRUIT', 'ENABLED'));
let recent = await signIn(browser, WHO.admin.email);
await go(recent, '/management/recruitment', 5000);
line(recent.url().includes('/management/recruitment'), 'L-04 mua rồi thì vào được Tuyển dụng', recent.url());
await go(recent, '/management/employees', 4000);
await recent.context().close();

console.log('—', setModule('cta', 'RECRUIT', 'NONE'));
recent = await signIn(browser, WHO.admin.email);
await go(recent, '/', 4000);
await openLauncher(recent);
const recentBlock = recent.locator('p', { hasText: 'Gần đây' }).first();
const hasRecent = (await recentBlock.count()) > 0;
const recentText = hasRecent ? clean(await recent.locator('div.mb-6').first().innerText()) : '';
line(!/Tuyển dụng/.test(recentText), 'L-04 ô khoá không còn trong mục Gần đây', `có mục Gần đây: ${hasRecent} | ${recentText}`);
line((await lockedCell(recent, 'rec').count()) === 1, 'L-04 bỏ mua thì ô Tuyển dụng trở lại trạng thái khoá');
await shot(recent, 'L-04-gan-day-khong-co-o-khoa');
await recent.context().close();

// ════════════════════════ L-07: bốn trạng thái khác của module ════════════════════════
/** Hai trạng thái phải khoá, kèm câu phải đọc được trong hộp thoại. */
for (const [tên, state, hạn, câu, nhãn] of [
	['tạm ngưng', 'DISABLED', undefined, 'Phân hệ Tuyển dụng đang tạm ngưng với công ty bạn.', 'Tạm ngưng'],
	['hết hạn quá lâu', 'ENABLED', '2026-10-01', 'Tuyển dụng đã hết hạn dùng nên đang tạm tắt', 'Đã hết hạn'],
]) {
	console.log('—', setModule('cta', 'RECRUIT', state, hạn));
	const page = await signIn(browser, WHO.admin.email);
	await go(page, '/', 4000);
	await openLauncher(page);
	line((await lockedCell(page, 'rec').count()) === 1, `L-07 ${tên}: ô Tuyển dụng bị khoá`);
	line(clean(await lockedCell(page, 'rec').innerText()).includes(nhãn), `L-07 ${tên}: nhãn trên ô là "${nhãn}"`, clean(await lockedCell(page, 'rec').innerText()));
	await lockedCell(page, 'rec').click();
	await page.waitForTimeout(900);
	const txt = clean(await dialog(page).innerText());
	line(txt.includes(câu), `L-07 ${tên}: hộp thoại nói đúng lý do`, txt);
	await shot(page, `L-07-${state === 'DISABLED' ? 'tam-ngung' : 'het-han-qua-lau'}`);
	await page.context().close();
}

/** Hai trạng thái vẫn vào được, chỉ kèm dòng báo trong trang. */
for (const [tên, state, hạn] of [
	['chỉ xem', 'READ_ONLY', undefined],
	['hết hạn còn xem được', 'ENABLED', '2026-11-10'],
]) {
	console.log('—', setModule('cta', 'RECRUIT', state, hạn));
	const page = await signIn(browser, WHO.admin.email);
	await go(page, '/', 4000);
	await openLauncher(page);
	line((await lockedCell(page, 'rec').count()) === 0, `L-07 ${tên}: ô Tuyển dụng không bị khoá`);
	await page.keyboard.press('Escape');
	await go(page, '/management/recruitment', 5500);
	line(page.url().includes('/management/recruitment'), `L-07 ${tên}: vẫn vào được màn tuyển dụng`, page.url());
	const notice = page.locator('[data-testid="module-notice"]').first();
	line((await notice.count()) > 0, `L-07 ${tên}: trang có dòng báo trạng thái module`);
	if (await notice.count()) {
		line(/chỉ xem|hết hạn/i.test(clean(await notice.innerText())), `L-07 ${tên}: dòng báo nói đúng chuyện`, clean(await notice.innerText()));
	}
	await shot(page, `L-07-${state === 'READ_ONLY' ? 'chi-xem' : 'het-han-con-xem'}`);
	await page.context().close();
}

// ════════════════════════ L-12: mua lại thì ô mở bình thường ════════════════════════
console.log('—', setModule('cta', 'RECRUIT', 'ENABLED'));
const back = await signIn(browser, WHO.admin.email);
await go(back, '/', 4000);
await openLauncher(back);
line((await lockedCell(back, 'rec').count()) === 0, 'L-12 mua lại thì không còn ô khoá');
await openCell(back, 'rec').first().click();
await back.waitForTimeout(4000);
line(back.url().includes('/recruitment'), 'L-12 bấm ô Tuyển dụng vào được phân hệ', back.url());
line((await back.locator('[data-testid="module-locked-dialog"]').count()) === 0, 'L-12 không còn hộp thoại chặn');
await shot(back, 'L-12-mua-lai-vao-duoc');
console.log('— lỗi console:', back.errors.filter(e => !e.includes('Failed to load resource')).slice(0, 5));
await back.context().close();

// Trả sandbox về trạng thái ban đầu: cta chưa mua Tuyển dụng.
console.log('—', setModule('cta', 'RECRUIT', 'NONE'));

process.exitCode = summary() ? 1 : 0;
await browser.close();
