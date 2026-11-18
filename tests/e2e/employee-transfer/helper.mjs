/**
 * Khung bấm thử hai loại thông báo chuyển nhân viên giữa hai công ty.
 *
 * Chạy trên sandbox của session BE. Cách gọi:
 *
 *   SMOKE_PASSWORD='<mật khẩu sandbox>' node tests/e2e/employee-transfer/smoke-transfer.mjs
 *
 * Mật khẩu đọc từ biến môi trường, KHÔNG ghi vào file: file này được commit, mà mật khẩu nằm
 * trong tệp đã commit thì cổng bảo mật trước khi commit chặn lại — và đúng là nên chặn.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');

// Trình duyệt Playwright tải sẵn lệch bản với repo, nên nhập `playwright-core` theo đường dẫn
// trong worktree rồi tự truyền `executablePath` tới Chrome của máy.
const { chromium } = await import(resolve(REPO, 'node_modules/playwright-core/index.mjs'));

export const API = process.env.SMOKE_API || 'http://127.0.0.1:3140';
export const WEB = process.env.SMOKE_WEB || 'http://localhost:4000';
export const SHOTS = process.env.SMOKE_SHOTS || resolve(REPO, 'tests/e2e/__shots__/employee-transfer');
const SHOTS_REL = 'tests/e2e/__shots__/employee-transfer';
const CHROME = process.env.SMOKE_CHROME || '/usr/bin/google-chrome';

export const PASSWORD = process.env.SMOKE_PASSWORD;
if (!PASSWORD) {
	console.error('Thiếu SMOKE_PASSWORD — đặt mật khẩu sandbox vào biến môi trường rồi chạy lại.');
	process.exit(2);
}

/** Tài khoản trên sandbox chuyển nhân viên (alpha là công ty cũ, beta là công ty nhận). */
export const WHO = {
	adminBeta: { email: 'admin@beta.drill', label: 'ADMIN công ty nhận' },
	adminAlpha: { email: 'admin@alpha.drill', label: 'ADMIN công ty cũ' },
	hrAlpha: { email: 'hr@alpha.drill', label: 'HR công ty cũ' },
	moved: { email: 'p1@alpha.drill', label: 'Người được chuyển hẳn' },
};

/** Hai tiêu đề máy chủ dựng; bài kiểm so đúng chuỗi này chứ không so gần đúng. */
export const TITLE_IN = '📌 Thông tin: Nhân viên chuyển tới';
export const TITLE_OUT = '📌 Thông tin: Nhân viên đã chuyển sang công ty khác';

mkdirSync(SHOTS, { recursive: true });

// ─── Khẳng định ───────────────────────────────────────────────────────────────
const results = [];

export function line(ok, name, detail = '') {
	results.push({ ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
}

export function note(text) {
	console.log(`  ⓘ ${text}`);
}

export function summary() {
	const bad = results.filter(r => !r.ok);
	console.log(`\n=== ${results.length - bad.length}/${results.length} khẳng định xanh ===`);
	for (const r of bad) console.log(`  ✗ ${r.name} — ${r.detail}`);
	return bad.length;
}

// ─── API: nguồn sự thật để so với màn hình ────────────────────────────────────
export async function apiLogin(email) {
	const res = await fetch(`${API}/v1/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identifier: email, password: PASSWORD }),
	});
	const json = await res.json();
	if (!res.ok) throw new Error(`Đăng nhập API lỗi ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
	return json.data ?? {};
}

/**
 * Đăng nhập API rồi vào hẳn một công ty.
 *
 * Tài khoản thuộc nhiều công ty thì `login` chỉ trả `selectionToken`, chưa có `accessToken`. Sau
 * khi F4 nhận lời mời thì HR công ty cũ rơi vào đúng trường hợp này, nên các bài còn lại phải tự
 * chọn công ty chứ không được giả định tài khoản chỉ có một công ty.
 */
export async function apiSession(email, companyCode) {
	const data = await apiLogin(email);
	if (!data.requiresCompanySelection) return data;
	const code = companyCode ?? data.companies?.[0]?.code;
	const res = await fetch(`${API}/v1/auth/select-company`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ selectionToken: data.selectionToken, companyCode: code }),
	});
	const json = await res.json();
	if (!res.ok) throw new Error(`Chọn công ty lỗi ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
	return json.data ?? {};
}

export async function apiNotifications(email, companyCode) {
	const data = await apiSession(email, companyCode);
	const res = await fetch(`${API}/v1/notifications?limit=50`, {
		headers: { Authorization: `Bearer ${data.accessToken}` },
	});
	const body = await res.json();
	return { auth: data, list: body.data ?? [], meta: body.meta ?? {} };
}

// ─── Trình duyệt ──────────────────────────────────────────────────────────────
export async function launch() {
	return chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
}

export async function newPage(browser) {
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	watchPage(page, { errors: [], netFails: [] });
	return page;
}

/**
 * Ghi lỗi của một tab, tách làm hai sổ.
 *
 * `errors` là lỗi JS thật — ngoại lệ chưa bắt và `console.error` do code gọi. `netFails` là
 * request trả mã lỗi. Gộp chung thì một endpoint sandbox thiếu dữ liệu cũng làm đỏ phép kiểm
 * "không lỗi JS", mà hai thứ đó phải chữa ở hai nơi khác nhau.
 */
function watchPage(page, books) {
	page.errors = books.errors;
	page.netFails = books.netFails;
	page.on('console', msg => {
		// Chrome báo request hỏng bằng console.error với đúng câu này; đã có sổ riêng cho nó.
		if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) page.errors.push(msg.text());
	});
	page.on('pageerror', err => page.errors.push(String(err)));
	page.on('response', res => {
		if (res.status() >= 400) page.netFails.push(`${res.status()} ${res.url()}`);
	});
}

/**
 * Đăng nhập rồi chờ vào được app.
 *
 * Chờ theo ĐIỀU KIỆN chứ không chờ cứng: lần mở trang đầu tiên của dev server còn phải biên dịch
 * nên chậm hơn hẳn các lần sau, chờ cứng thì bài đỏ oan ở đúng lần chạy đầu.
 *
 * Tài khoản thuộc nhiều công ty thì có bước chọn công ty; truyền `company` là mã công ty cần vào.
 */
export async function signIn(browser, email, opts = {}) {
	const page = opts.page ?? (await newPage(browser));
	await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
	await page.locator('#email').first().waitFor({ state: 'visible', timeout: 180000 });
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();

	if (opts.company) {
		const pick = page.locator(`[data-company-code="${opts.company}"]`);
		await pick.waitFor({ state: 'visible', timeout: 180000 });
		await pick.click();
	}
	/**
	 * Thanh bên chỉ dựng sau khi vào được một công ty, nên nó là mốc "đã vào app".
	 *
	 * Chờ dài bằng lúc chờ ô email: sau khi bấm đăng nhập app nhảy sang `/management`, và ở chế độ
	 * dev Vite biên dịch chunk của trang đó lúc có người mở nó lần đầu. Lần chạy đầu tiên sau khi
	 * bật dev server mất hơn một phút, nên chờ ngắn thì bài đỏ oan đúng ở lần chạy đầu.
	 */
	await page.locator('aside').first().waitFor({ state: 'visible', timeout: 180000 });
	// Rồi chờ ô công ty ở thanh trên, vì đó là chỗ bài kiểm đọc tên công ty đang mở.
	await page
		.locator('[data-testid="company-switcher"], [data-testid="company-name"]')
		.first()
		.waitFor({ state: 'visible', timeout: 120000 });
	await page.waitForTimeout(1500);
	return page;
}

export async function go(page, path, waitMs = 3000) {
	await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(waitMs);
}

export function clean(s) {
	return s.replace(/\s+/g, ' ').trim();
}

// ─── Chuông thông báo ─────────────────────────────────────────────────────────
const BELL = '[data-notif-panel] > button';
/** Khung thả của chuông: thẻ em kế tiếp của nút, chỉ có khi chuông đang mở. */
const PANEL = '[data-notif-panel] > div';

/**
 * Mở chuông rồi chờ danh sách nạp xong.
 *
 * Panel vẽ xong trước khi `GET /v1/notifications` trả về, nên đọc ngay thì gặp vòng xoay chờ và
 * kết luận "không có thông báo" — chờ tới khi hết vòng xoay mới đọc được thật.
 */
export async function openBell(page, timeout = 30000) {
	await page.locator(BELL).first().click();
	await page.locator(PANEL).first().waitFor({ state: 'visible', timeout: 15000 });
	const until = Date.now() + timeout;
	for (;;) {
		const text = clean(await page.locator(PANEL).first().innerText());
		const spinning = (await page.locator(`${PANEL} .animate-spin`).count()) > 0;
		if (!spinning && text.length > 0) return text;
		if (Date.now() > until) return text;
		await page.waitForTimeout(250);
	}
}

export async function closeBell(page) {
	await page.locator(BELL).first().click();
	await page.waitForTimeout(400);
}

/** Số trên huy hiệu đỏ của chuông; `null` là không có huy hiệu (không có thông báo chưa đọc). */
export async function bellBadge(page) {
	const badge = page.locator(`${BELL} span`).first();
	if ((await badge.count()) === 0) return null;
	return clean(await badge.innerText());
}

/** Một dòng thông báo trong chuông, tìm theo tiêu đề. */
export function bellItem(page, title) {
	return page.locator(`${PANEL} p`, { hasText: title });
}

export async function shot(page, name, opts = {}) {
	// Huy hiệu Nuxt devtools chỉ có ở bản dev và nó đè lên đáy màn hình.
	await page
		.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' })
		.catch(() => {});
	const target = opts.selector ? page.locator(opts.selector).first() : page;
	await target.screenshot({ path: `${SHOTS}/${name}.png`, ...(opts.selector ? {} : { fullPage: true }) });
	return `${SHOTS_REL}/${name}.png`;
}

/**
 * Ảnh chụp một dải từ đỉnh trang, dùng cho mọi khung thả đang mở (chuông, bộ chọn công ty).
 *
 * Chụp riêng khung thả thì mất cái chuông và mất tên công ty, mà hai thứ đó mới cho biết ảnh là
 * của ai; còn chụp cả trang (`fullPage`) thì Playwright phải kéo dài khung nhìn, và cú đổi kích
 * thước đó đóng mất khung thả nên ảnh ra trang không có gì. Nên chụp đúng một dải, không kéo dài.
 */
export async function shotStrip(page, name, height = 620) {
	await page
		.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' })
		.catch(() => {});
	await page.screenshot({ path: `${SHOTS}/${name}.png`, clip: { x: 0, y: 0, width: 1440, height } });
	return `${SHOTS_REL}/${name}.png`;
}
