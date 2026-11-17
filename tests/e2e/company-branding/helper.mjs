/**
 * Khung bấm thử logo, favicon và tiêu đề tab theo công ty.
 *
 * Chạy trên sandbox của session BE. Cách gọi:
 *
 *   SMOKE_PASSWORD='<mật khẩu sandbox>' node tests/e2e/company-branding/smoke-branding.mjs
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
const { chromium, devices } = await import(resolve(REPO, 'node_modules/playwright-core/index.mjs'));

export const API = process.env.SMOKE_API || 'http://127.0.0.1:3140';
export const WEB = process.env.SMOKE_WEB || 'http://localhost:4000';
export const SHOTS = process.env.SMOKE_SHOTS || resolve(REPO, 'tests/e2e/__shots__/company-branding');
const CHROME = process.env.SMOKE_CHROME || '/usr/bin/google-chrome';

export const PASSWORD = process.env.SMOKE_PASSWORD;
if (!PASSWORD) {
	console.error('Thiếu SMOKE_PASSWORD — đặt mật khẩu sandbox vào biến môi trường rồi chạy lại.');
	process.exit(2);
}

/** Tài khoản trên sandbox. `ctya` có logo và favicon, `ctyb` chưa có gì. */
export const WHO = {
	adminBoth: { email: 'admin@ctya.drill', label: 'ADMIN hai công ty' },
	hr: { email: 'hr@ctya.drill', label: 'HR' },
	manager: { email: 'manager@ctya.drill', label: 'MANAGER' },
	employee: { email: 'nv@ctya.drill', label: 'EMPLOYEE' },
	adminB: { email: 'admin@ctyb.drill', label: 'ADMIN công ty chưa có logo' },
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

/** Công ty mà API đang trả cho tài khoản này: bài kiểm so với máy chủ, không so với số ghi cứng. */
export async function apiCompanies(email) {
	const res = await fetch(`${API}/v1/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identifier: email, password: PASSWORD }),
	});
	const data = (await res.json()).data ?? {};
	return data.requiresCompanySelection ? data.companies : [data.company];
}

// ─── Trình duyệt ──────────────────────────────────────────────────────────────
export async function launch() {
	return chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
}

export const PHONE = { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } };

export async function newPage(browser, opts = {}) {
	const ctx = await browser.newContext(opts.phone ? PHONE : { viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	watchPage(page, { errors: [], netFails: [] });
	if (opts.route) await opts.route(page);
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
 * Đăng nhập, chọn công ty nếu tài khoản thuộc nhiều công ty.
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

	if (opts.company) {
		const pick = page.locator(`[data-company-code="${opts.company}"]`);
		await pick.waitFor({ state: 'visible', timeout: 60000 });
		await pick.click();
	}
	// Thanh bên chỉ dựng sau khi vào được một công ty, nên nó là mốc "đã vào app".
	await page.locator('aside').first().waitFor({ state: 'visible', timeout: 60000 });
	/**
	 * Rồi chờ tới lúc có MỘT trong hai logo.
	 *
	 * Sau khi đăng nhập app còn nhảy `/` → `/management`, giữa hai lần dựng có một khoảnh khắc
	 * thanh bên đã hiện mà ô logo chưa vẽ xong. Chờ cứng vài giây thì có lần rơi trúng khoảnh
	 * khắc đó và bài đỏ oan, nên chờ tới khi thấy logo.
	 */
	await page
		.locator('[data-testid="sidebar-company-logo"], [data-testid="sidebar-app-logo"]')
		.first()
		.waitFor({ state: 'visible', timeout: 60000 });
	await page.waitForTimeout(1200);
	return page;
}

/**
 * Tab mới trong cùng phiên đăng nhập, đóng tab cũ.
 *
 * Mở hàng chục trang liên tiếp trong một tab làm Chrome hết tài nguyên
 * (`ERR_INSUFFICIENT_RESOURCES`): mỗi lần tải lại ở chế độ dev mở thêm một websocket HMR và vài
 * trăm request module. Đổi tab là trả lại hết, mà cookie phiên nằm ở context nên không phải
 * đăng nhập lại.
 */
export async function rotateTab(page) {
	const ctx = page.context();
	const next = await ctx.newPage();
	watchPage(next, { errors: page.errors, netFails: page.netFails });
	await page.close();
	return next;
}

/** Tiêu đề khai trong `nuxt.config.ts`, tức là tiêu đề của khoảnh khắc app chưa chạy. */
export const BOOT_TITLE = 'Hệ thống nhân sự';

export async function go(page, path, waitMs = 2500) {
	await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(waitMs);
}

/**
 * Chờ app chạy xong rồi hãy đọc tiêu đề.
 *
 * Ở chế độ dev, Vite biên dịch chunk của trang lúc có người mở nó lần đầu, trang lạ mất vài
 * giây. Đọc sớm thì thấy tiêu đề khai trong `nuxt.config.ts` chứ không phải tiêu đề app ghép —
 * đọc nhầm khoảnh khắc đó rồi kết luận là tiêu đề sai thì sửa nhầm chỗ.
 */
export async function titleWhenReady(page, timeout = 25000) {
	const until = Date.now() + timeout;
	for (;;) {
		const title = await page.title();
		if (title !== BOOT_TITLE) return title;
		if (Date.now() > until) return title;
		await page.waitForTimeout(250);
	}
}

export function clean(s) {
	return s.replace(/\s+/g, ' ').trim();
}

export async function shot(page, name, opts = {}) {
	// Huy hiệu Nuxt devtools chỉ có ở bản dev và nó đè lên đáy màn hình.
	await page
		.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' })
		.catch(() => {});
	// Dải "tab" là thẻ `position:fixed` nên nó đè lên cả ảnh chụp riêng một phần tử; ảnh chụp
	// riêng thanh bên thì gỡ dải đi, chỉ ảnh toàn trang mới mang nó.
	if (opts.selector) await page.evaluate(() => document.getElementById('smoke-tab-stamp')?.remove());
	const target = opts.selector ? page.locator(opts.selector).first() : page;
	await target.screenshot({ path: `${SHOTS}/${name}.png`, ...(opts.selector ? {} : { fullPage: true }) });
	return `tests/e2e/__shots__/company-branding/${name}.png`;
}

/**
 * Dán một dải "tab trình duyệt" vào trang để ảnh chụp mang được tiêu đề và favicon.
 *
 * Playwright chụp phần nội dung, không chụp khung trình duyệt, nên tiêu đề tab và icon tab không
 * vào ảnh được. Dải này vẽ đúng chuỗi `document.title` đang có và đúng URL trong thẻ
 * `<link rel="icon">`, nên ảnh vẫn là bằng chứng đọc được — nhưng nó do bài kiểm vẽ ra, không
 * phải khung thật của Chrome, và ảnh ghi rõ như vậy.
 */
export async function stampTab(page) {
	await page.evaluate(() => {
		document.getElementById('smoke-tab-stamp')?.remove();
		const icon = document.querySelector('link[rel="icon"]');
		const bar = document.createElement('div');
		bar.id = 'smoke-tab-stamp';
		bar.style.cssText =
			'position:fixed;top:0;left:0;right:0;z-index:2147483647;display:flex;align-items:center;gap:8px;'
			+ 'padding:6px 10px;background:#111827;color:#f9fafb;font:600 13px/1.3 system-ui,sans-serif;'
			+ 'border-bottom:2px solid #f59e0b';
		const img = document.createElement('img');
		img.src = icon ? icon.href : '';
		img.style.cssText = 'width:16px;height:16px;object-fit:contain;flex:0 0 auto';
		const label = document.createElement('span');
		label.textContent = document.title;
		const note = document.createElement('span');
		note.textContent = '← tiêu đề + favicon của tab (dải này do bài kiểm vẽ)';
		note.style.cssText = 'margin-left:auto;font-weight:400;opacity:.65';
		bar.append(img, label, note);
		document.body.appendChild(bar);
	});
}

/** Mọi thẻ `<link rel="icon">` đang có trên trang, kèm `href` đã giải đầy đủ. */
export async function iconLinks(page) {
	return page.evaluate(() =>
		[...document.querySelectorAll('link[rel="icon"]')].map(el => ({
			raw: el.getAttribute('href'),
			href: el.href,
		})),
	);
}

/** Ảnh đã tải được thật hay chỉ là thẻ rỗng — `naturalWidth` là thước đo duy nhất đáng tin. */
export async function imgInfo(page, selector) {
	return page.evaluate(sel => {
		const el = document.querySelector(sel);
		if (!el) return null;
		const box = el.getBoundingClientRect();
		return {
			src: el.getAttribute('src'),
			naturalWidth: el.naturalWidth,
			naturalHeight: el.naturalHeight,
			objectFit: getComputedStyle(el).objectFit,
			width: Math.round(box.width * 100) / 100,
			height: Math.round(box.height * 100) / 100,
			left: Math.round(box.left * 100) / 100,
			right: Math.round(box.right * 100) / 100,
		};
	}, selector);
}

/** Chờ tới khi ảnh có mặt và tải xong, thay cho chờ cứng rồi đo vào lúc trang còn đang dựng. */
export async function waitImg(page, selector, timeout = 20000) {
	const until = Date.now() + timeout;
	for (;;) {
		const info = await imgInfo(page, selector);
		if (info && info.naturalWidth > 0) return info;
		if (Date.now() > until) return info;
		await page.waitForTimeout(200);
	}
}

/**
 * Ảnh favicon tải được hay không — mở thẳng URL bằng chính phiên của trình duyệt.
 *
 * Trình duyệt tải favicon ngoài vòng đời trang nên không bắt được qua DOM; cách chắc chắn là gọi
 * lại URL đó rồi xem mã trả về và kiểu nội dung.
 */
export async function fetchHead(page, url) {
	return page.evaluate(async u => {
		try {
			const res = await fetch(u, { method: 'GET' });
			return { status: res.status, type: res.headers.get('content-type') };
		} catch (e) {
			return { status: 0, type: null, error: String(e) };
		}
	}, url);
}
