/**
 * Bấm thử "Chấm công bằng khuôn mặt" (23/11/2026) trên sandbox của session BE, camera giả của Chrome.
 *
 * Chạy: node tests/e2e/face-attendance/smoke.mjs (web 4996 và API 3193 phải đang chạy).
 * Bài GHI dữ liệu sandbox (đăng ký nv2, chấm công nv1 nv2 nv3 nv4, xoá khuôn mặt nv1, tắt rồi bật
 * công tắc), nên chỉ chạy trọn được một lần sau mỗi lần dựng lại sandbox. Ảnh chụp lưu ở
 * tests/e2e/__shots__/face-attendance/.
 *
 * Tài khoản và mật khẩu đọc lúc chạy từ file sandbox, không ghi trong bài.
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SANDBOX = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-face/sandbox-face.json', 'utf8'));
const API = SANDBOX.api; // …/v1
const WEB = SANDBOX.web.origin;
const ACC = SANDBOX.accounts;
const CAM = SANDBOX.camera;
const SHOTS = resolve(dirname(fileURLToPath(import.meta.url)), '../__shots__/face-attendance');
mkdirSync(SHOTS, { recursive: true });

const results = [];
function line(id, ok, name, detail = '') {
	results.push({ id, ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${id} ${name}${detail ? ` — ${detail}` : ''}`);
}
// --only F1,F8 chạy lẻ vài bài (lưu ý bài nào cũng có thể ghi dữ liệu sandbox).
const ONLY = (process.argv.find(a => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
async function step(id, name, fn) {
	if (ONLY.length && !ONLY.includes(id)) return;
	try {
		await fn();
	} catch (err) {
		line(id, false, name, `lỗi bài: ${String(err?.message ?? err).split('\n')[0]}`);
	}
}

// ─── API: chỉ đọc lại trạng thái để đối chiếu ─────────────────────────────────
const tokens = {};
async function apiLogin(email) {
	const res = await fetch(`${API}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password: SANDBOX.password }),
	});
	const json = await res.json();
	if (!json?.data?.accessToken) throw new Error(`đăng nhập API thất bại ${email}`);
	tokens[email] = json.data;
	return json.data;
}
async function apiGet(email, path) {
	const auth = tokens[email] ?? (await apiLogin(email));
	const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
	return res.json();
}
function vnToday() {
	return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
const myToday = async email => (await apiGet(email, `/attendance/me?date=${vnToday()}&limit=1`)).data?.[0] ?? null;

// ─── Trình duyệt: mỗi file camera một browser ─────────────────────────────────
const browsers = {};
async function browserFor(camera) {
	if (!browsers[camera]) {
		browsers[camera] = await chromium.launch({
			executablePath: '/usr/bin/google-chrome',
			args: [
				'--no-sandbox',
				'--use-fake-ui-for-media-stream',
				'--use-fake-device-for-media-stream',
				`--use-file-for-fake-video-capture=${CAM[camera]}`,
			],
		});
	}
	return browsers[camera];
}

async function signIn(email, { camera = 'blank', phone = false } = {}) {
	const browser = await browserFor(camera);
	const ctx = await browser.newContext({
		viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
		...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
		permissions: ['camera', 'geolocation'],
		geolocation: { latitude: 21.0285, longitude: 105.8542 },
	});
	const page = await ctx.newPage();
	page.errors = [];
	page.on('pageerror', err => page.errors.push(String(err)));
	await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(1500);
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(SANDBOX.password);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForTimeout(2500);
	const pick = page.locator('[data-company-code]');
	if (await pick.count()) {
		await pick.first().click();
		await page.waitForTimeout(2500);
	}
	return page;
}
async function goto(page, path, wait = 2500) {
	await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(wait);
}
async function shot(page, name) {
	await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}
const close = page => page.context().close();
const hasText = async (page, re) => (await page.getByText(re).count()) > 0;
async function overflowX(page) {
	return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

// Màn chấm công: chờ kiểm vị trí xong.
async function openCheckIn(page) {
	await goto(page, '/attendance/check-in', 4000);
}
// Bấm nút chụp trong camera toàn màn hình rồi chờ máy chủ so mặt.
async function snap(page) {
	const cam = page.locator('div.fixed.inset-0.bg-black');
	await cam.waitFor({ state: 'visible', timeout: 10000 });
	await page.waitForTimeout(1500);
	await cam.locator('button').nth(1).click();
	await page.waitForTimeout(4000);
}
async function clockOut(page) {
	await page.getByRole('button', { name: 'Clock Out' }).first().click();
	await page.waitForTimeout(500);
	await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
}
const mismatch = page => page.locator('[data-testid="face-mismatch"]');
const register = page => page.locator('[data-testid="face-register"]');

// ─── F1: admin tắt rồi bật lại ────────────────────────────────────────────────
await step('F1', 'admin tắt rồi bật công tắc', async () => {
	const page = await signIn(ACC.admin.email);
	await goto(page, '/management/settings');
	const card = page.getByText('Chấm công bằng khuôn mặt', { exact: true });
	const seesCard = await card.first().isVisible({ timeout: 5000 }).catch(() => false);
	await card.first().click();
	await page.waitForTimeout(2500);
	const sw = page.locator('[data-testid="face-setting-switch"]');
	const before = await sw.getAttribute('aria-checked');

	await sw.click();
	await page.waitForTimeout(400);
	const askOff = await page.locator('[data-testid="face-confirm-dialog"]').innerText();
	await page.locator('[data-testid="face-confirm-dialog"]').getByRole('button', { name: 'Tắt' }).click();
	await page.waitForTimeout(1500);
	const toastOff = await hasText(page, 'Đã tắt chấm công bằng khuôn mặt');
	const apiOff = (await apiGet(ACC.admin.email, '/attendance/face/settings')).data?.enabled;

	await sw.click();
	await page.waitForTimeout(400);
	const askOn = await page.locator('[data-testid="face-confirm-dialog"]').innerText();
	await shot(page, 'F1-xac-nhan-bat');
	await page.locator('[data-testid="face-confirm-dialog"]').getByRole('button', { name: 'Bật' }).click();
	await page.waitForTimeout(1500);
	const toastOn = await hasText(page, 'Đã bật chấm công bằng khuôn mặt');
	const after = await sw.getAttribute('aria-checked');
	const apiOn = (await apiGet(ACC.admin.email, '/attendance/face/settings')).data?.enabled;
	await shot(page, 'F1-trang-cai-dat-admin');

	line(
		'F1',
		seesCard && before === 'true' && apiOff === false && toastOff && toastOn && after === 'true' && apiOn === true &&
			/Từ lúc bật, mọi nhân viên phải đăng ký khuôn mặt trước lần chấm công tới/.test(askOn),
		'tắt rồi bật, có hỏi xác nhận',
		`thẻ ${seesCard}, trước ${before}, hỏi tắt "${askOff.split('\n')[0]}", toast tắt ${toastOff}, API tắt ${apiOff}, toast bật ${toastOn}, sau ${after}, API bật ${apiOn}`,
	);
	await close(page);
});

// ─── F2: hr thấy danh sách, công tắc không bấm được ───────────────────────────
await step('F2', 'hr mở trang cài đặt khuôn mặt', async () => {
	const page = await signIn(ACC.hr.email);
	await goto(page, '/management/settings');
	const seesCard = await hasText(page, /^Chấm công bằng khuôn mặt$/);
	await goto(page, '/management/settings/face-attendance', 3000);
	const disabled = await page.locator('[data-testid="face-setting-switch"]').isDisabled();
	const rows = await page.locator('[data-testid="face-row"]').count();
	await page.locator('[data-testid="face-search"]').fill('nv');
	await page.waitForTimeout(300);
	await page.locator('[data-testid="face-search"]').fill('');
	await page.getByRole('button', { name: /^Chưa đăng ký/ }).click();
	await page.waitForTimeout(300);
	const unregistered = await page.locator('[data-testid="face-row"]').count();
	await page.getByRole('button', { name: /^Tất cả/ }).click();
	await page.waitForTimeout(500);
	await shot(page, 'F2-trang-cai-dat-hr');
	line('F2', seesCard && disabled && rows > 0, 'danh sách hiện, công tắc khoá', `thẻ ${seesCard}, công tắc khoá ${disabled}, ${rows} dòng, chưa đăng ký ${unregistered}`);
	await close(page);
});

// ─── F3 + F4: nv2 bị đưa sang đăng ký; ảnh trống và ảnh nhiều người ───────────
await step('F3', 'nv2 bị đưa sang bước đăng ký', async () => {
	const page = await signIn(ACC.nv2.email, { camera: 'blank' });
	await goto(page, '/management/settings');
	const blocked = !page.url().includes('/management/settings');
	await openCheckIn(page);
	const opened = await register(page).isVisible();
	const submit = page.locator('[data-testid="face-register-submit"]');
	const lockedBefore = await submit.isDisabled();
	await shot(page, 'F3-buoc-dang-ky');
	await page.locator('[data-testid="face-consent"]').check();
	await page.waitForTimeout(300);
	const lockedAfter = await submit.isDisabled();
	line('F3', blocked && opened && lockedBefore && !lockedAfter, 'không vào được cài đặt, tự mở bước đăng ký, nút khoá khi chưa tick', `chặn cài đặt ${blocked}, mở đăng ký ${opened}, khoá trước tick ${lockedBefore}, mở sau tick ${!lockedAfter}`);

	// F4a: camera trống
	await submit.click();
	await page.waitForTimeout(4000);
	const errBlank = (await page.locator('[data-testid="face-register-error"]').innerText().catch(() => '')).trim();
	await shot(page, 'F4-loi-khong-thay-mat');
	await close(page);

	// F4b: camera nhiều người
	const page2 = await signIn(ACC.nv2.email, { camera: 'group' });
	await openCheckIn(page2);
	await page2.locator('[data-testid="face-consent"]').check();
	await page2.locator('[data-testid="face-register-submit"]').click();
	await page2.waitForTimeout(4000);
	const errGroup = (await page2.locator('[data-testid="face-register-error"]').innerText().catch(() => '')).trim();
	await shot(page2, 'F4-loi-nhieu-mat');
	line('F4', /Không thấy khuôn mặt/.test(errBlank) && /nhiều khuôn mặt/.test(errGroup), 'ảnh trống và ảnh nhiều người hiện đúng câu', `trống: "${errBlank}" | nhóm: "${errGroup}"`);
	await close(page2);
});

// ─── F5: nv2 đăng ký bằng obama rồi đi thẳng sang chấm công ───────────────────
await step('F5', 'nv2 đăng ký rồi check-in', async () => {
	const page = await signIn(ACC.nv2.email, { camera: 'obama' });
	await openCheckIn(page);
	await page.locator('[data-testid="face-consent"]').check();
	await page.locator('[data-testid="face-register-submit"]').click();
	await page.waitForTimeout(4000);
	const cameraOpened = await page.locator('div.fixed.inset-0.bg-black').isVisible();
	await snap(page);
	const ok = await hasText(page, 'Check-in thành công!');
	const rec = await myToday(ACC.nv2.email);
	const me = (await apiGet(ACC.nv2.email, '/attendance/face/me')).data;
	line('F5', cameraOpened && ok && rec?.checkInFaceResult === 'MATCHED' && me?.registered, 'đăng ký xong đi thẳng sang camera chấm công, check-in khớp', `camera tự mở ${cameraOpened}, thành công ${ok}, kết quả ${rec?.checkInFaceResult}, đã đăng ký ${me?.registered}`);
	await close(page);
});

// ─── F6: nv1 camera biden: không khớp, chụp lại, vẫn xác nhận ─────────────────
await step('F6', 'nv1 không khớp → chụp lại → vẫn xác nhận', async () => {
	const page = await signIn(ACC.nv1.email, { camera: 'biden' });
	await openCheckIn(page);
	await page.getByRole('button', { name: 'Clock In' }).first().click();
	await snap(page);
	const first = await mismatch(page).innerText().catch(() => '');
	await shot(page, 'F6-hop-thoai-khong-khop');
	await page.locator('[data-testid="face-retake"]').click();
	await snap(page);
	const second = await mismatch(page).innerText().catch(() => '');
	await page.locator('[data-testid="face-confirm"]').click();
	await page.waitForTimeout(4000);
	const ok = await hasText(page, 'Check-in thành công!');
	const rec = await myToday(ACC.nv1.email);
	line('F6', /còn 4 lượt/.test(first) && /còn 3 lượt/.test(second) && ok && rec?.checkInFaceResult === 'CONFIRMED_MISMATCH', 'hộp thoại còn 4, chụp lại còn 3, vẫn xác nhận thành công', `lần 1 "${first.match(/còn \d+ lượt/)?.[0]}", lần 2 "${second.match(/còn \d+ lượt/)?.[0]}", thành công ${ok}, kết quả ${rec?.checkInFaceResult}`);
	await close(page);
});

// ─── F7: nv4 đã hết lượt: chỉ còn Vẫn xác nhận ───────────────────────────────
await step('F7', 'nv4 hết lượt chỉ còn Vẫn xác nhận', async () => {
	const page = await signIn(ACC.nv4.email, { camera: 'biden' });
	await openCheckIn(page);
	await page.getByRole('button', { name: 'Clock In' }).first().click();
	await snap(page);
	const visible = await mismatch(page).isVisible();
	const retake = await page.locator('[data-testid="face-retake"]').count();
	const text = await mismatch(page).innerText().catch(() => '');
	await shot(page, 'F7-het-luot-chi-con-van-xac-nhan');
	await page.locator('[data-testid="face-confirm"]').click();
	await page.waitForTimeout(4000);
	const ok = await hasText(page, 'Check-in thành công!');
	const rec = await myToday(ACC.nv4.email);
	line('F7', visible && retake === 0 && ok && rec?.checkInFaceResult === 'CONFIRMED_MISMATCH', 'không có Chụp lại, vẫn xác nhận thành công', `hộp thoại ${visible}, nút Chụp lại ${retake}, "${text.match(/hết lượt[^.]*/)?.[0] ?? ''}", thành công ${ok}, kết quả ${rec?.checkInFaceResult}`);
	await close(page);
});

// ─── F8: nv3 check-out bằng biden: khớp ──────────────────────────────────────
await step('F8', 'nv3 check-out khớp', async () => {
	const page = await signIn(ACC.nv3.email, { camera: 'biden' });
	await openCheckIn(page);
	await clockOut(page);
	await snap(page);
	const ok = await hasText(page, 'Check-out thành công!');
	const dialog = await mismatch(page).count();
	const said = dialog ? (await mismatch(page).locator('p').first().innerText()).trim() : '';
	await shot(page, dialog ? 'F8-hop-thoai-khi-check-out' : 'F8-check-out-khop');
	const rec = await myToday(ACC.nv3.email);
	line('F8', ok && dialog === 0 && rec?.checkOutFaceResult === 'MATCHED', 'check-out thành công, không hộp thoại', `thành công ${ok}, hộp thoại ${dialog}${said ? ` "${said}"` : ''}, kết quả ${rec?.checkOutFaceResult}`);
	await close(page);
});

// ─── F9: hồ sơ của tôi ───────────────────────────────────────────────────────
await step('F9', 'nv1, nv2 thấy thẻ khuôn mặt ở hồ sơ', async () => {
	const out = [];
	for (const key of ['nv1', 'nv2']) {
		const page = await signIn(ACC[key].email);
		await goto(page, '/profile', 3500);
		const card = page.locator('[data-testid="profile-face-card"]');
		await card.scrollIntoViewIfNeeded();
		const img = await card.locator('img').count();
		const text = await card.innerText();
		if (key === 'nv1') await card.screenshot({ path: `${SHOTS}/F9-the-ho-so.png` });
		out.push({ key, img, ask: /nhờ phòng nhân sự xoá khuôn mặt cũ/.test(text) });
		await close(page);
	}
	line('F9', out.every(o => o.img === 1 && o.ask), 'ảnh đã đăng ký và câu nhờ HR', out.map(o => `${o.key}: ảnh ${o.img}, câu nhờ HR ${o.ask}`).join('; '));
});

// ─── F11: bảng chấm công, lọc Cần xem lại ────────────────────────────────────
await step('F11', 'hr lọc Cần xem lại', async () => {
	const page = await signIn(ACC.hr.email);
	await goto(page, '/management/attendance', 3500);
	const before = await page.locator('tbody tr').count();
	await page.locator('[data-testid="face-filter-today"] button').first().click();
	await page.waitForTimeout(300);
	await page.getByRole('button', { name: 'Cần xem lại', exact: true }).last().click();
	await page.waitForTimeout(2500);
	const rows = await page.locator('tbody tr').allInnerTexts();
	const chips = await page.locator('[data-testid="face-chip"]').count();
	await shot(page, 'F11-loc-can-xem-lai');
	const names = rows.map(r => r.split('\n')[0].trim());
	line('F11', rows.length === 3 && chips === 3, 'thấy bản ghi nv3, nv1, nv4 có chip', `trước lọc ${before} dòng, sau lọc ${rows.length} dòng [${names.join(', ')}], ${chips} chip`);
	await close(page);
});

// ─── F13a: hộp thoại không khớp ở cỡ điện thoại (giả lời máy chủ, không ghi dữ liệu) ─
await step('F13', 'cỡ 390×844: hộp thoại không khớp', async () => {
	const page = await signIn(ACC.nv1.email, { camera: 'biden', phone: true });
	await page.route('**/v1/attendance/check-out', route =>
		route.fulfill({
			status: 400,
			contentType: 'application/json',
			body: JSON.stringify({
				success: false,
				error: { code: 'FACE_NOT_MATCHED', message: 'Khuôn mặt chưa khớp với khuôn mặt đã đăng ký. Bạn chụp lại, hoặc bấm "Vẫn xác nhận" nếu đúng là bạn.', errors: [{ attemptsLeft: 3 }] },
			}),
		}),
	);
	await openCheckIn(page);
	await clockOut(page);
	await snap(page);
	const box = await mismatch(page).locator('div.max-w-sm').boundingBox();
	const ovf = await overflowX(page);
	const btns = await Promise.all(['face-retake', 'face-confirm'].map(id => page.locator(`[data-testid="${id}"]`).isEnabled()));
	await shot(page, 'F13-dien-thoai-hop-thoai-khong-khop');
	page.f13 = { ok: !!box && box.x >= 0 && box.x + box.width <= 390 && ovf <= 0 && btns.every(Boolean), detail: `hộp ${Math.round(box?.x ?? -1)}..${Math.round((box?.x ?? 0) + (box?.width ?? 0))}px, tràn ngang ${ovf}px, nút bấm được ${btns.join('/')}` };
	globalThis.F13A = page.f13;
	await close(page);
});

// ─── F14: 503 FACE_ENGINE_UNAVAILABLE ────────────────────────────────────────
await step('F14', 'máy chủ chưa so được mặt (503)', async () => {
	const page = await signIn(ACC.nv1.email, { camera: 'biden' });
	await page.route('**/v1/attendance/check-out', route =>
		route.fulfill({
			status: 503,
			contentType: 'application/json',
			body: JSON.stringify({ success: false, error: { code: 'FACE_ENGINE_UNAVAILABLE', message: 'Máy chủ chưa sẵn sàng nhận diện khuôn mặt. Bạn thử lại sau ít phút.' } }),
		}),
	);
	await openCheckIn(page);
	await clockOut(page);
	await snap(page);
	const toast = await hasText(page, 'Máy chủ chưa sẵn sàng nhận diện khuôn mặt');
	const dialog = await mismatch(page).count();
	const pageAlive = await page.getByRole('button', { name: 'Clock Out' }).count();
	await shot(page, 'F14-loi-503-toast');
	line('F14', toast && dialog === 0 && pageAlive > 0 && page.errors.length === 0, 'toast lỗi, không trắng trang', `toast ${toast}, hộp thoại ${dialog}, nút Clock Out còn ${pageAlive}, lỗi JS ${page.errors.length}`);
	await close(page);
});

// ─── F10: hr xoá khuôn mặt nv1; nv1 vào chấm công bị đưa sang đăng ký ──────────
await step('F10', 'hr xoá khuôn mặt nv1', async () => {
	const nv1 = tokens[ACC.nv1.email] ?? (await apiLogin(ACC.nv1.email));
	const nv1Id = nv1.user.id;
	const page = await signIn(ACC.hr.email);
	await goto(page, `/management/employees/${nv1Id}`, 3500);
	await page.getByRole('button', { name: 'Định danh', exact: true }).click();
	await page.waitForTimeout(2500);
	const block = page.locator('[data-testid="employee-face"]');
	await block.scrollIntoViewIfNeeded();
	const hadImg = await block.locator('img').count();
	await block.screenshot({ path: `${SHOTS}/F10-khoi-hr-truoc-khi-xoa.png` });
	await page.locator('[data-testid="employee-face-reset"]').click();
	await page.waitForTimeout(400);
	const ask = await page.locator('[data-testid="face-confirm-dialog"]').innerText();
	await page.locator('[data-testid="face-confirm-dialog"]').getByRole('button', { name: 'Xoá', exact: true }).click();
	await page.waitForTimeout(2500);
	const after = await block.innerText();
	await close(page);

	// nv1 vào chấm công ở cỡ điện thoại: cũng là ảnh F13 cho bước đăng ký.
	const phone = await signIn(ACC.nv1.email, { camera: 'obama', phone: true });
	await openCheckIn(phone);
	const toRegister = await register(phone).isVisible();
	const ovf = await overflowX(phone);
	const box = await register(phone).boundingBox();
	const submitOk = await phone.locator('[data-testid="face-consent"]').isVisible();
	await shot(phone, 'F13-dien-thoai-buoc-dang-ky');
	line('F10', hadImg === 1 && /phải đăng ký lại/.test(ask) && /Chưa đăng ký khuôn mặt/.test(after) && toRegister, 'xác nhận, khối đổi sang chưa đăng ký, nv1 bị đưa sang đăng ký', `ảnh trước ${hadImg}, hỏi "${ask.split('\n')[1] ?? ''}", sau xoá "${after.split('\n')[1] ?? ''}", nv1 sang đăng ký ${toRegister}`);
	const a = globalThis.F13A ?? { ok: false, detail: 'chưa chạy' };
	const regOk = toRegister && ovf <= 0 && !!box && box.width <= 390 && submitOk;
	line('F13', a.ok && regOk, 'cỡ 390×844 không vỡ, nút bấm được', `hộp thoại không khớp: ${a.detail}; bước đăng ký: rộng ${Math.round(box?.width ?? 0)}px, tràn ngang ${ovf}px, ô đồng ý hiện ${submitOk}`);
	await close(phone);
});

// ─── F12: admin tắt; nv2 chấm công luồng cũ; bật lại ─────────────────────────
await step('F12', 'tắt tính năng thì luồng cũ', async () => {
	const admin = await signIn(ACC.admin.email);
	await goto(admin, '/management/settings/face-attendance', 3000);
	const sw = admin.locator('[data-testid="face-setting-switch"]');
	await sw.click();
	await admin.locator('[data-testid="face-confirm-dialog"]').getByRole('button', { name: 'Tắt' }).click();
	await admin.waitForTimeout(1500);
	const off = (await apiGet(ACC.admin.email, '/attendance/face/settings')).data?.enabled === false;

	// nv2 dùng camera trống: còn so mặt thì chắc chắn bị từ chối, nên thành công là đã bỏ bước khuôn mặt.
	const page = await signIn(ACC.nv2.email, { camera: 'blank' });
	await openCheckIn(page);
	const banner = await page.locator('[data-testid="face-register-banner"]').count();
	await clockOut(page);
	await snap(page);
	const ok = await hasText(page, 'Check-out thành công!');
	const dialog = await mismatch(page).count();
	const rec = await myToday(ACC.nv2.email);
	await close(page);

	await sw.click();
	await admin.locator('[data-testid="face-confirm-dialog"]').getByRole('button', { name: 'Bật' }).click();
	await admin.waitForTimeout(1500);
	const on = (await apiGet(ACC.admin.email, '/attendance/face/settings')).data?.enabled === true;
	await close(admin);
	line('F12', off && banner === 0 && ok && dialog === 0 && rec?.checkOutFaceResult === null && on, 'luồng cũ khi tắt, bật lại sau', `tắt ${off}, thẻ đăng ký ${banner}, check-out thành công ${ok}, hộp thoại ${dialog}, kết quả check-out ${rec?.checkOutFaceResult}, bật lại ${on}`);
});

for (const b of Object.values(browsers)) await b.close();
const order = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14'];
results.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
const pass = results.filter(r => r.ok).length;
console.log(`\n${pass}/${results.length} đạt`);
process.exitCode = pass === results.length ? 0 : 1;
