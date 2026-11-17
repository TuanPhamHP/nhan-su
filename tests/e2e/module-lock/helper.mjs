/**
 * Khung bấm thử việc khoá phân hệ: mở trình duyệt thật, đăng nhập sandbox, ghi từng khẳng định.
 *
 * Trình duyệt Playwright tải sẵn lệch bản với repo nên import `playwright-core` bằng đường dẫn
 * tuyệt đối và tự truyền `executablePath` tới Chrome của máy.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium, devices } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';

/**
 * Mặc định là sandbox lô 4a của đợt 1. Đợt 2 (hotline) chạy trên sandbox khác nên đặt đè bằng
 * biến môi trường thay vì chép cả khung này ra file thứ hai — một khung, hai lô dữ liệu.
 */
const SANDBOX_DIR = '/home/tuanpham/work/hr-system/.sandbox-4a';
export const API = process.env.SMOKE_API || 'http://localhost:3170';
export const WEB = process.env.SMOKE_WEB || 'http://localhost:4021';
export const SHOTS = process.env.SMOKE_SHOTS
	|| '/home/tuanpham/work/hr-system/.worktrees/fe-module-lock/tests/e2e/__shots__/module-lock';
const SANDBOX_FILE = process.env.SMOKE_SANDBOX_FILE || `${SANDBOX_DIR}/sandbox-4a.json`;
const CHROME = '/usr/bin/google-chrome';

/**
 * Đọc tài khoản và mật khẩu LÚC CHẠY. File này được ghi mới mỗi lần dựng lại sandbox, và mật khẩu
 * nằm trong file đã commit sẽ bị cổng bảo mật trước khi commit chặn.
 */
const sandbox = JSON.parse(readFileSync(SANDBOX_FILE, 'utf8'));
export const PASSWORD = sandbox.password;
/** Hotline mà sandbox đang trả — `undefined` ở lô 4a vì lô đó chưa có trường này. */
export const SANDBOX_HOTLINE = sandbox.businessHotline ?? null;

/** Người dùng của hai công ty trên sandbox: `cta` đã mua Tài sản, `old` chưa mua gì. */
export const WHO = {
	admin: { email: sandbox.people.admin.email, name: sandbox.people.admin.name },
	hr: { email: sandbox.people.hr.email, name: sandbox.people.hr.name },
	kd1: { email: sandbox.people.kd1.email, name: sandbox.people.kd1.name },
	// Chỉ có ở lô 4a; lô `ml` của đợt 2 chỉ có một công ty nên khoá này không dùng tới.
	oldAdmin: { email: 'admin@old.drill', name: 'Quản trị' },
};

mkdirSync(SHOTS, { recursive: true });

// ─── Khẳng định ───────────────────────────────────────────────────────────────
const results = [];

export function line(ok, name, detail = '') {
	results.push({ ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
}

export function summary() {
	const bad = results.filter(r => !r.ok);
	console.log(`\n=== ${results.length - bad.length}/${results.length} khẳng định xanh ===`);
	for (const r of bad) console.log(`  ✗ ${r.name} — ${r.detail}`);
	return bad.length;
}

/**
 * Đặt trạng thái module của một công ty như người vận hành đặt trong control plane.
 *
 * Dùng chính script của session BE (`set-module-4a.cjs`), script đó tự chặn nếu cổng không phải
 * cổng sandbox, nên bài này không tự viết câu SQL nào.
 */
export function setModule(tenant, code, state, expires) {
	const args = [`${SANDBOX_DIR}/set-module-4a.cjs`, tenant, code, state];
	if (expires) args.push(expires);
	const out = execFileSync('node', args, { encoding: 'utf8', cwd: SANDBOX_DIR });
	return out.trim();
}

/**
 * Hỏi thẳng API xem hotline đang là gì.
 *
 * Bài bấm thử phải so với thứ máy chủ ĐANG trả, không so với một số ghi cứng: người vận hành đổi
 * `BUSINESS_HOTLINE` rồi khởi động lại API là câu trong hộp thoại đổi theo, mà bài kiểm ghi cứng
 * thì đỏ oan.
 */
export async function apiHotline(email) {
	const login = await fetch(`${API}/v1/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password: PASSWORD }),
	});
	const token = (await login.json()).data.accessToken;
	const res = await fetch(`${API}/v1/me/entitlements`, { headers: { Authorization: `Bearer ${token}` } });
	const data = (await res.json()).data ?? {};
	return data.businessHotline ?? null;
}

// ─── Trình duyệt ──────────────────────────────────────────────────────────────
export async function launch() {
	return chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
}

export const PHONE = { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } };

export async function signIn(browser, email, opts = {}) {
	const ctx = await browser.newContext(opts.phone ? PHONE : { viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	page.errors = [];
	page.on('console', msg => {
		if (msg.type() === 'error') page.errors.push(msg.text());
	});
	page.on('pageerror', err => page.errors.push(String(err)));

	if (opts.route) await opts.route(page);

	await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
	// Lần mở trang đầu tiên của dev server phải biên dịch nên lâu hơn hẳn mặc định 30 giây của
	// Playwright. Chờ hẳn ô email hiện ra thay vì chờ cứng rồi gõ vào chỗ chưa có.
	await page.locator('#email').first().waitFor({ state: 'visible', timeout: 120000 });
	await page.waitForTimeout(600);
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForTimeout(4000);
	return page;
}

export async function go(page, path, waitMs = 3500) {
	await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(waitMs);
}

export async function text(page) {
	return clean(await page.locator('body').innerText());
}

export function clean(s) {
	return s.replace(/\s+/g, ' ').trim();
}

export async function shot(page, name) {
	// Huy hiệu Nuxt devtools chỉ có ở bản dev và nó đè lên đáy màn hình.
	await page
		.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' })
		.catch(() => {});
	await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
	return `tests/e2e/__shots__/module-lock/${name}.png`;
}

export async function toastText(page, timeout = 12000) {
	const toast = page.locator('div.fixed.top-4.right-4 [role="alert"]').first();
	try {
		await toast.waitFor({ state: 'visible', timeout });
		return clean(await toast.innerText());
	} catch {
		return '';
	}
}

/** Mở lưới chọn phân hệ từ nút trong header. */
export async function openLauncher(page) {
	await page.locator('[aria-label="Chuyển phân hệ"]').first().click();
	await page.waitForTimeout(1200);
}

/** Trang có tràn ngang hay không — thước đo duy nhất đáng tin cho bố cục điện thoại. */
export async function overflow(page) {
	return page.evaluate(() => ({
		scroll: document.documentElement.scrollWidth,
		client: document.documentElement.clientWidth,
	}));
}
