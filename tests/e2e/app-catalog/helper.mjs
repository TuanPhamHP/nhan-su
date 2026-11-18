/**
 * Khung bấm thử lưới chọn phân hệ lấy danh mục từ server.
 *
 *   node tests/e2e/app-catalog/smoke-catalog.mjs
 *
 * Tài khoản và mật khẩu đọc LÚC CHẠY từ file sandbox của session BE: file đó được ghi mới mỗi lần
 * dựng lại sandbox, và mật khẩu nằm trong tệp đã commit thì cổng bảo mật trước khi commit chặn.
 *
 * Không dùng chung `tests/e2e/module-lock/helper.mjs` được: khung đó đọc `sandbox.people.*`, còn
 * file sandbox của lô này có hình dạng khác (`admins`, `employee`).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');

// Trình duyệt Playwright tải sẵn lệch bản với repo, nên nhập `playwright-core` theo đường dẫn
// trong worktree rồi tự truyền `executablePath` tới Chrome của máy.
const { chromium } = await import(resolve(REPO, 'node_modules/playwright-core/index.mjs'));

const SANDBOX_FILE = process.env.SMOKE_SANDBOX_FILE || '/home/tuanpham/work/hr-system/.sandbox-4a/sandbox-ac.json';
const sandbox = JSON.parse(readFileSync(SANDBOX_FILE, 'utf8'));

export const API = (process.env.SMOKE_API || sandbox.api).replace(/\/v1$/, '');
export const WEB = process.env.SMOKE_WEB || 'http://localhost:4022';
export const SHOTS = process.env.SMOKE_SHOTS || resolve(REPO, 'tests/e2e/__shots__/app-catalog');
const SHOTS_REL = 'tests/e2e/__shots__/app-catalog';
const CHROME = process.env.SMOKE_CHROME || '/usr/bin/google-chrome';

export const PASSWORD = sandbox.password;
/** `full` mua đủ, `none` chưa mua gì, `susp` Tài sản tạm ngưng, `lapsed` Tài sản quá hạn. */
export const WHO = { ...sandbox.admins, employee: sandbox.employee };

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

// ─── API: danh mục máy chủ đang trả, để so với màn hình ───────────────────────
export async function apiEntitlements(email) {
	const login = await fetch(`${API}/v1/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identifier: email, password: PASSWORD }),
	});
	const json = await login.json();
	if (!login.ok) throw new Error(`Đăng nhập ${email} lỗi ${login.status}: ${JSON.stringify(json).slice(0, 200)}`);
	const res = await fetch(`${API}/v1/me/entitlements`, {
		headers: { Authorization: `Bearer ${json.data.accessToken}` },
	});
	return (await res.json()).data ?? {};
}

/** `#0ea5e9` → `rgb(14, 165, 233)`, dạng mà `getComputedStyle` trả về. */
export function hexToRgb(hex) {
	const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
	if (!m) return hex;
	return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}

// ─── Trình duyệt ──────────────────────────────────────────────────────────────
export async function launch() {
	return chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
}

export async function newPage(browser, opts = {}) {
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	page.errors = [];
	page.netFails = [];
	page.on('console', msg => {
		// Chrome báo request hỏng bằng console.error với đúng câu này; request hỏng có sổ riêng.
		if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) page.errors.push(msg.text());
	});
	page.on('pageerror', err => page.errors.push(String(err)));
	page.on('response', res => {
		if (res.status() >= 400) page.netFails.push(`${res.status()} ${res.url()}`);
	});
	if (opts.route) await opts.route(page);
	return page;
}

/**
 * Đăng nhập rồi chờ vào được app.
 *
 * Chờ theo ĐIỀU KIỆN chứ không chờ cứng: lần mở trang đầu tiên của dev server còn phải biên dịch
 * nên chậm hơn hẳn các lần sau, chờ cứng thì bài đỏ oan ở đúng lần chạy đầu.
 */
export async function signIn(browser, email, opts = {}) {
	const page = opts.page ?? (await newPage(browser, opts));
	await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
	await page.locator('#email').first().waitFor({ state: 'visible', timeout: 180000 });
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.locator('aside').first().waitFor({ state: 'visible', timeout: 180000 });
	await page.waitForTimeout(2000);
	return page;
}

export async function go(page, path, waitMs = 3000) {
	await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(waitMs);
}

export function clean(s) {
	return s.replace(/\s+/g, ' ').trim();
}

// ─── Lưới chọn phân hệ ────────────────────────────────────────────────────────
const LAUNCHER = '[role="dialog"][aria-modal="true"]';

export async function openLauncher(page, waitMs = 1500) {
	await page.locator('[data-testid="app-launcher-button"]').first().click();
	await page.locator(LAUNCHER).first().waitFor({ state: 'visible', timeout: 20000 });
	await page.waitForTimeout(waitMs);
}

export async function closeLauncher(page) {
	await page.keyboard.press('Escape');
	await page.waitForTimeout(400);
}

/** Nội dung từng ô trong lưới, đọc thẳng từ DOM để so với API. */
export async function tilesOnScreen(page) {
	return page.evaluate(() => {
		const read = (el, locked) => {
			const icon = el.querySelector('svg path');
			const box = el.querySelector('span');
			return {
				code: el.getAttribute(locked ? 'data-locked-app' : 'data-app'),
				locked,
				text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
				icon: icon ? icon.getAttribute('d') : null,
				color: box ? getComputedStyle(box).backgroundColor : null,
			};
		};
		return [
			...[...document.querySelectorAll('[data-app]')].map(el => read(el, false)),
			...[...document.querySelectorAll('[data-locked-app]')].map(el => read(el, true)),
		];
	});
}

/** Tên các nhóm trong lưới, theo đúng thứ tự hiện trên màn hình. */
export async function groupsOnScreen(page) {
	return page.evaluate(sel => {
		const panel = document.querySelector(sel);
		if (!panel) return [];
		return [...panel.querySelectorAll('p.uppercase')].map(p => (p.textContent ?? '').trim());
	}, LAUNCHER);
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

/** Ảnh riêng khung lưới chọn phân hệ — phần đáng so trước sau. */
export async function shotLauncher(page, name) {
	return shot(page, name, { selector: LAUNCHER });
}
