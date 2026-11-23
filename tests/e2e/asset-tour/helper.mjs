/**
 * Khung bấm thử hướng dẫn từng bước của ba trang Tài sản (bàn giao BE 21/11/2026).
 *
 * Sandbox BE ở 3180 và web ở 4998 (CORS chỉ mở cho 4998). Tài khoản và mật khẩu đọc lúc chạy từ
 * `.sandbox-tour/sandbox-tour.json`, không ghi vào bài: mật khẩu nằm trong file đã commit là thứ
 * cổng bảo mật trước khi commit chặn.
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const SANDBOX = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-tour/sandbox-tour.json', 'utf8'));
export const API = SANDBOX.api.replace(/\/v1$/, '');
export const WEB = 'http://127.0.0.1:4998';
const PASSWORD = SANDBOX.password;
export const WHO = Object.fromEntries(Object.entries(SANDBOX.accounts).map(([k, v]) => [k, v.email]));
export const ASSETS = SANDBOX.assets;
export const SHOTS = '/home/tuanpham/work/hr-system/.worktrees/fe-asset-tour/tests/e2e/__shots__/asset-tour';
mkdirSync(SHOTS, { recursive: true });

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
	if (!json?.data?.accessToken) throw new Error(`đăng nhập API thất bại ${email}`);
	return json.data.accessToken;
}

export async function assetTotal(token) {
	const res = await fetch(`${API}/v1/assets?page=1&limit=1`, { headers: { Authorization: `Bearer ${token}` } });
	const json = await res.json();
	return json?.meta?.total ?? -1;
}

export async function launch() {
	return chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
}

/**
 * Đăng nhập trong một context mới (localStorage sạch). `opts.blockStorage` làm mọi lần đọc ghi
 * localStorage ném lỗi, như trình duyệt chặn lưu trữ.
 */
export async function signIn(browser, email, opts = {}) {
	const ctx = await browser.newContext({
		viewport: opts.phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
		deviceScaleFactor: opts.phone ? 2 : 1,
		isMobile: !!opts.phone,
		hasTouch: !!opts.phone,
		acceptDownloads: true,
	});
	if (opts.dark) await ctx.addCookies([{ name: 'color-mode', value: 'dark', url: WEB }]);
	if (opts.blockStorage) {
		await ctx.addInitScript(() => {
			const boom = () => {
				throw new DOMException('Bị chặn trong bài thử', 'SecurityError');
			};
			Storage.prototype.getItem = boom;
			Storage.prototype.setItem = boom;
		});
	}
	const page = await ctx.newPage();
	page.errors = [];
	page.writes = [];
	page.on('pageerror', err => page.errors.push(String(err)));
	page.on('console', msg => {
		if (msg.type() === 'error' && !/Failed to load resource/i.test(msg.text())) page.errors.push(msg.text());
	});
	// Mọi request ghi tới API sau lúc đăng nhập: tour không được tạo ra request nào như vậy.
	page.on('request', req => {
		if (req.url().startsWith(API) && req.method() !== 'GET' && !/\/auth\//.test(req.url())) {
			page.writes.push(`${req.method()} ${req.url().replace(API, '')}`);
		}
	});
	await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
	await page.locator('#email').first().waitFor({ timeout: 90000 });
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 30000 });
	await page.waitForTimeout(1500);
	return page;
}

export const BOX = '[data-tour-overlay] [role="dialog"]';

export async function tourOpen(page) {
	return (await page.locator('[data-tour-overlay]').count()) > 0;
}

/** Chờ hộp hướng dẫn hiện một bước đã trỏ xong (có số bước). */
export async function waitShown(page, timeout = 15000) {
	await page.locator(`${BOX} p.text-xs`).filter({ hasText: /Bước \d+\/\d+/ }).first().waitFor({ timeout });
	await page.waitForTimeout(450);
}

export async function readStep(page) {
	return page.evaluate(sel => {
		const box = document.querySelector(sel);
		if (!box) return null;
		const counter = box.querySelector('p.text-xs')?.textContent?.trim() ?? '';
		const m = /Bước (\d+)\/(\d+)/.exec(counter);
		const action = box.querySelector('p.bg-brand-50 span')?.textContent?.trim() ?? '';
		const buttons = [...box.querySelectorAll('button')].map(b => b.textContent.trim());
		return {
			number: m ? Number(m[1]) : 0,
			total: m ? Number(m[2]) : 0,
			title: box.querySelector('#tour-box-title')?.textContent?.trim() ?? '',
			body: box.querySelector('#tour-box-body')?.textContent?.trim() ?? '',
			action,
			buttons,
		};
	}, BOX);
}

export async function boxButton(page, name) {
	return page.locator(BOX).getByRole('button', { name, exact: true });
}

/** Bấm nút chính của hộp (Tiếp, Xong) rồi chờ bước sau trỏ xong. */
export async function next(page) {
	const before = await readStep(page);
	await page.locator(BOX).getByRole('button', { name: /^(Tiếp|Xong)$/ }).click();
	await page.waitForFunction(
		([sel, title, num]) => {
			const box = document.querySelector(sel);
			if (!box) return true;
			const t = box.querySelector('#tour-box-title')?.textContent?.trim();
			const c = box.querySelector('p.text-xs')?.textContent ?? '';
			return (t !== title || !c.includes(`Bước ${num}/`)) && /Bước \d+\//.test(c);
		},
		[BOX, before.title, before.number],
		{ timeout: 15000 },
	);
	await page.waitForTimeout(450);
}

/** Toạ độ ô sáng và phần tử đang được trỏ, để kiểm ô sáng bám đúng phần tử. */
export async function holeInfo(page, selector) {
	return page.evaluate(sel => {
		const ring = document.querySelector('[data-tour-overlay] .ring-2');
		const els = [...document.querySelectorAll(sel)].filter(el => el.getClientRects().length > 0);
		const rects = els.map(el => el.getBoundingClientRect());
		const box = document.querySelector('[data-tour-overlay] [role="dialog"]')?.getBoundingClientRect();
		const union = rects.length
			? {
					top: Math.min(...rects.map(r => r.top)),
					left: Math.min(...rects.map(r => r.left)),
					bottom: Math.max(...rects.map(r => r.bottom)),
					right: Math.max(...rects.map(r => r.right)),
				}
			: null;
		const r = ring?.getBoundingClientRect();
		return {
			hole: r ? { top: r.top, left: r.left, bottom: r.bottom, right: r.right } : null,
			target: union,
			box: box ? { top: box.top, left: box.left, bottom: box.bottom, right: box.right } : null,
			view: { width: innerWidth, height: innerHeight },
		};
	}, selector);
}

/** Ô sáng ôm phần tử với lề 8 px (sai số 1.5 px). */
export function holeFits(info) {
	if (!info.hole || !info.target) return false;
	const d = (a, b) => Math.abs(a - b) <= 1.5;
	return (
		d(info.hole.top, info.target.top - 8) &&
		d(info.hole.left, info.target.left - 8) &&
		d(info.hole.bottom, info.target.bottom + 8) &&
		d(info.hole.right, info.target.right + 8)
	);
}

export function overlaps(a, b) {
	if (!a || !b) return false;
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Bấm chuột thật vào giữa phần tử đầu tiên khớp bộ chọn. */
export async function clickCenter(page, selector) {
	const box = await page.locator(selector).first().boundingBox();
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

export async function shot(page, name) {
	await page.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' }).catch(() => {});
	const path = `${SHOTS}/${name}.png`;
	await page.screenshot({ path });
	return path;
}

export function clean(s) {
	return String(s).replace(/\s+/g, ' ').trim();
}
