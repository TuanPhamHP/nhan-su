/**
 * Khung bấm thử form "Thêm mặt hàng" khi cộng số vào dòng đã có (bàn giao BE 20/11/2026).
 *
 * Sandbox BE ở 3176 và web ở 4999 do session BE dựng sẵn. Mật khẩu đọc lúc chạy từ hằng PASSWORD
 * của script sandbox, không ghi vào bài: mật khẩu nằm trong file đã commit là thứ cổng bảo mật
 * trước khi commit chặn.
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

export const API = 'http://127.0.0.1:3176';
export const WEB = 'http://127.0.0.1:4999';
export const SHOTS = '/home/tuanpham/work/hr-system/.worktrees/fe-supply-merge-line/tests/e2e/__shots__/supply-merge';
mkdirSync(SHOTS, { recursive: true });

const drill = readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/drill-supply.cjs', 'utf8');
const match = /const PASSWORD\s*=\s*['"`]([^'"`]+)['"`]/.exec(drill);
if (!match) throw new Error('không đọc được PASSWORD trong drill-supply.cjs');
export const PASSWORD = match[1];

export const WHO = {
	admin: 'admin@smer.drill',
	nv1: 'nv1@smer.drill',
	nv2: 'nv2@smer.drill',
	kt: 'kt@smer.drill',
};

const results = [];
export function line(id, ok, name, detail = '') {
	results.push({ id, ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${id} ${name}${detail ? ` — ${detail}` : ''}`);
}
export function summary() {
	const bad = results.filter(r => !r.ok);
	console.log(`\n=== ${results.length - bad.length}/${results.length} xanh ===`);
	for (const r of bad) console.log(`  ✗ ${r.id} ${r.name} — ${r.detail}`);
	return bad.length;
}

export async function apiToken(email) {
	const res = await fetch(`${API}/v1/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password: PASSWORD }),
	});
	const json = await res.json();
	if (!json?.data?.accessToken) throw new Error(`đăng nhập API thất bại ${email}: ${JSON.stringify(json).slice(0, 200)}`);
	return json.data.accessToken;
}

export async function api(token, path, opts = {}) {
	const res = await fetch(`${API}${path}`, {
		method: opts.method ?? 'GET',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: opts.body ? JSON.stringify(opts.body) : undefined,
	});
	const text = await res.text();
	let json = null;
	try {
		json = JSON.parse(text);
	} catch {
		json = null;
	}
	return { status: res.status, json };
}

export async function launch() {
	return chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
}

export async function signIn(browser, email, opts = {}) {
	const ctx = await browser.newContext({
		viewport: opts.phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
		deviceScaleFactor: opts.phone ? 2 : 1,
		isMobile: !!opts.phone,
		hasTouch: !!opts.phone,
	});
	const page = await ctx.newPage();
	page.errors = [];
	page.on('pageerror', err => page.errors.push(String(err)));
	page.on('console', msg => {
		if (msg.type() === 'error' && !/Failed to load resource/i.test(msg.text())) page.errors.push(msg.text());
	});
	await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
	// Lần đầu mở một khổ màn mới, Vite còn biên dịch nên ô email tới chậm hơn 30 giây mặc định.
	await page.locator('#email').first().waitFor({ timeout: 90000 });
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForTimeout(4000);
	return page;
}

export async function openSupplies(page) {
	await page.goto(`${WEB}/office/supplies`, { waitUntil: 'domcontentloaded' });
	await page.getByText('Thêm mặt hàng').first().waitFor({ timeout: 20000 });
	await page.waitForTimeout(800);
}

export function clean(s) {
	return String(s).replace(/\s+/g, ' ').trim();
}

export async function shot(page, name, opts = {}) {
	await page.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' }).catch(() => {});
	const path = `${SHOTS}/${name}.png`;
	if (opts.locator) await opts.locator.screenshot({ path });
	else await page.screenshot({ path, fullPage: !!opts.fullPage });
	return `tests/e2e/__shots__/supply-merge/${name}.png`;
}

const TOAST = 'div.fixed.top-4.right-4 [role="alert"]';
export async function clearToasts(page) {
	await page.evaluate(() => {
		document.querySelectorAll('div.fixed.top-4.right-4 [role="alert"] button').forEach(b => b.click());
	});
	await page.waitForTimeout(400);
}
export async function toastText(page, timeout = 10000) {
	const until = Date.now() + timeout;
	while (Date.now() < until) {
		const items = await page.locator(TOAST).all();
		if (items.length) {
			const parts = [];
			for (const item of items) parts.push(clean(await item.innerText()));
			return parts.join(' | ');
		}
		await page.waitForTimeout(250);
	}
	return '';
}

/** Khối form "Thêm mặt hàng". */
export function addSection(page) {
	return page.locator('section', { has: page.getByRole('heading', { name: 'Thêm mặt hàng' }) });
}
