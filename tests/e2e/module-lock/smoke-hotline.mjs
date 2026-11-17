/**
 * Đợt 2 — hotline nhà cung cấp trong hộp thoại phân hệ chưa đăng ký (T-01..T-04).
 *
 * Chạy trên sandbox riêng của nhánh này (công ty `ml` chưa mua cả Tài sản lẫn Tuyển dụng), khác
 * sandbox lô 4a của đợt 1. Gọi bằng:
 *
 *   SMOKE_API=http://localhost:3140 SMOKE_WEB=http://localhost:4020 \
 *   SMOKE_SANDBOX_FILE=/home/tuanpham/work/hr-system/.sandbox-4a/sandbox-ml.json \
 *   node tests/e2e/module-lock/smoke-hotline.mjs
 *
 * Bài tự hỏi API xem hotline đang có hay không rồi chạy nhánh tương ứng: có số thì kiểm T-01, T-02,
 * T-04; không số thì kiểm T-03. Nhờ vậy khi BE khởi động lại sandbox bỏ hotline, chạy lại đúng
 * script này là xong, không phải sửa gì.
 */
import { WHO, apiHotline, clean, go, launch, line, openLauncher, overflow, shot, signIn, summary } from './helper.mjs';

const lockedCell = (page, code) => page.locator(`[data-locked-app="${code}"]`);
const dialog = page => page.locator('[data-testid="module-locked-dialog"]');
const hint = page => page.locator('[data-testid="module-locked-hint"]');
const hotlineLink = page => page.locator('[data-testid="module-locked-hotline"]');

const HOTLINE = await apiHotline(WHO.admin.email);
console.log(HOTLINE ? `API đang trả hotline: ${HOTLINE}` : 'API đang KHÔNG trả hotline (nhánh T-03)');

const browser = await launch();

/**
 * Mở lưới rồi bấm ô Tuyển dụng đang khoá — đường người dùng thật đi.
 *
 * Chờ theo ĐIỀU KIỆN chứ không chờ cứng vài trăm mili giây: lần mở trang đầu tiên của dev server
 * còn phải biên dịch nên chậm hơn hẳn các lần sau, chờ cứng thì bài đỏ oan ở đúng lần chạy đầu.
 */
async function openLockedDialog(page) {
	await go(page, '/', 4000);
	await openLauncher(page);
	const cell = lockedCell(page, 'rec');
	await cell.waitFor({ state: 'visible', timeout: 20000 });
	await cell.click();
	await dialog(page).waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
}

// ════════════════════ T-01 / T-03: quản trị viên ════════════════════
{
	const admin = await signIn(browser, WHO.admin.email);
	await openLockedDialog(admin);
	line((await dialog(admin).count()) === 1, 'hộp thoại mở được từ ô khoá');

	const hintText = clean(await hint(admin).innerText());

	if (HOTLINE) {
		line(
			hintText === `Liên hệ nhà cung cấp phần mềm qua hotline ${HOTLINE} để đăng ký thêm phân hệ này.`,
			'T-01 câu hướng dẫn của quản trị viên có hotline, đúng từng chữ',
			hintText,
		);
		line((await hotlineLink(admin).count()) === 1, 'T-01 số hotline là một liên kết');
		const href = await hotlineLink(admin).getAttribute('href');
		const expected = `tel:${HOTLINE.replace(/[^\d+]/g, '')}`;
		line(href === expected, 'T-01 liên kết bấm gọi được', `href=${href}, mong đợi ${expected}`);
		line(
			clean(await hotlineLink(admin).innerText()) === HOTLINE,
			'T-01 số hiện đúng như máy chủ trả',
			await hotlineLink(admin).innerText(),
		);
		await shot(admin, 'T-01-admin-co-hotline');
	} else {
		line(
			hintText === 'Liên hệ nhà cung cấp phần mềm để đăng ký thêm phân hệ này.',
			'T-03 không có hotline thì quản trị viên đọc lại câu cũ',
			hintText,
		);
		line(!/hotline/i.test(hintText), 'T-03 câu cũ không có chữ "hotline"', hintText);
		line((await hotlineLink(admin).count()) === 0, 'T-03 không có liên kết số nào');
		line(!/\d{8,}/.test(hintText), 'T-03 không có số điện thoại nào trong câu', hintText);
		await shot(admin, 'T-03-admin-khong-co-hotline');
	}

	// Câu chính của hộp thoại không đổi theo hotline.
	const all = clean(await dialog(admin).innerText());
	line(
		all.includes('Công ty bạn chưa đăng ký phân hệ Tuyển dụng.'),
		'câu chính vẫn nói đúng chuyện chưa đăng ký',
		all,
	);
	line(admin.errors.length === 0, 'không lỗi JS', admin.errors.slice(0, 2).join(' | '));
	await admin.context().close();
}

// ════════════════════ T-02: HR và nhân viên ════════════════════
for (const [key, who] of [['hr', WHO.hr], ['kd1', WHO.kd1]]) {
	const page = await signIn(browser, who.email);
	await openLockedDialog(page);
	line((await dialog(page).count()) === 1, `T-02 ${key} mở được hộp thoại từ ô khoá`);

	const hintText = clean(await hint(page).innerText());
	line(
		hintText === 'Bạn liên hệ quản trị viên của công ty nếu cần dùng phân hệ này.',
		`T-02 ${key} đọc câu liên hệ quản trị viên của công ty`,
		hintText,
	);
	line((await hotlineLink(page).count()) === 0, `T-02 ${key} không thấy liên kết hotline`);
	// Kiểm cả hộp thoại chứ không chỉ câu hướng dẫn: số không được lọt ra chỗ nào khác.
	const all = clean(await dialog(page).innerText());
	line(
		!HOTLINE || !all.includes(HOTLINE),
		`T-02 ${key} không thấy số hotline ở bất kỳ đâu trong hộp thoại`,
		all,
	);
	await shot(page, `T-02-${key}-khong-co-so`);
	line(page.errors.length === 0, `T-02 ${key} không lỗi JS`, page.errors.slice(0, 2).join(' | '));
	await page.context().close();
}

// ════════════════════ T-04: điện thoại 390px ════════════════════
{
	const phone = await signIn(browser, WHO.admin.email, { phone: true });
	await openLockedDialog(phone);
	line((await dialog(phone).count()) === 1, 'T-04 hộp thoại mở được trên điện thoại');

	const { scroll, client } = await overflow(phone);
	line(scroll <= client, 'T-04 hộp thoại không làm trang tràn ngang', `scroll ${scroll} > client ${client}`);

	const box = await dialog(phone).locator('[role="dialog"]').boundingBox();
	line(box !== null && box.x >= 0 && box.x + box.width <= 390, 'T-04 hộp thoại nằm gọn trong 390px', JSON.stringify(box));

	if (HOTLINE) {
		const link = hotlineLink(phone);
		line((await link.count()) === 1, 'T-04 số hotline vẫn là liên kết trên điện thoại');
		const lb = await link.boundingBox();
		// Mục tiêu bấm phải đủ lớn để ngón tay chạm trúng.
		line(lb !== null && lb.height >= 16 && lb.width >= 60, 'T-04 vùng bấm số đủ rộng để chạm', JSON.stringify(lb));
		line(
			(await link.getAttribute('href')).startsWith('tel:'),
			'T-04 bấm số mở trình gọi (href tel:)',
			await link.getAttribute('href'),
		);
	}
	await shot(phone, HOTLINE ? 'T-04-dien-thoai-co-hotline' : 'T-04-dien-thoai-khong-hotline');
	line(phone.errors.length === 0, 'T-04 không lỗi JS', phone.errors.slice(0, 2).join(' | '));
	await phone.context().close();
}

// ════════════════════ T-06: quản trị viên đang xem giao diện nhân viên ════════════════════
// Bản xem thử phải nói đúng thứ nhân viên thấy, kể cả câu hướng dẫn và cả số hotline.
{
	const admin = await signIn(browser, WHO.admin.email);
	await go(admin, '/management', 4000);

	await admin.locator('[data-user-menu] button').first().click();
	await admin.waitForTimeout(600);
	const toggle = admin.getByRole('button', { name: 'Xem giao diện nhân viên' });
	line((await toggle.count()) === 1, 'T-06 có nút chuyển sang xem giao diện nhân viên');
	await toggle.click();
	await admin.waitForTimeout(3000);
	await shot(admin, 'T-06-dang-xem-giao-dien-nhan-vien');

	/**
	 * Từ đây KHÔNG được `page.goto` nữa: `previewRole` chỉ nằm trong bộ nhớ của store, tải lại
	 * trang là mất chế độ xem thử và quản trị viên quay về giao diện quản trị. Nút trong header đã
	 * đẩy sang `/` bằng router rồi, nên chỉ cần mở lưới ngay tại chỗ.
	 */
	line(new URL(admin.url()).pathname === '/', 'T-06 đã chuyển sang trang của nhân viên', admin.url());
	await openLauncher(admin);
	const cell = lockedCell(admin, 'rec');
	await cell.waitFor({ state: 'visible', timeout: 20000 });
	await cell.click();
	await dialog(admin).waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
	line((await dialog(admin).count()) === 1, 'T-06 vẫn mở được hộp thoại từ ô khoá');

	const hintText = clean(await hint(admin).innerText());
	line(
		hintText === 'Bạn liên hệ quản trị viên của công ty nếu cần dùng phân hệ này.',
		'T-06 đọc đúng câu của nhân viên, không phải câu của quản trị viên',
		hintText,
	);
	line((await hotlineLink(admin).count()) === 0, 'T-06 không có liên kết tel:');
	const all = clean(await dialog(admin).innerText());
	line(
		!HOTLINE || !all.includes(HOTLINE),
		'T-06 không thấy số hotline ở bất kỳ đâu trong hộp thoại',
		all,
	);
	if (!HOTLINE) {
		console.log('  ↑ sandbox đang KHÔNG có hotline nên phép kiểm "ẩn số" chỉ là hình thức;'
			+ ' chạy lại bài này trên sandbox có hotline mới chứng minh được.');
	}
	await shot(admin, 'T-06-xem-nhu-nhan-vien-khong-co-so');
	line(admin.errors.length === 0, 'T-06 không lỗi JS', admin.errors.slice(0, 2).join(' | '));
	await admin.context().close();
}

await browser.close();
process.exit(summary() === 0 ? 0 : 1);
