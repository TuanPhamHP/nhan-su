/**
 * Khung bấm thử việc lưu lời báo lỗi của trợ lý AI.
 *
 *   SMOKE_PASSWORD='<mật khẩu sandbox>' node tests/e2e/agent-error/smoke-agent-error.mjs
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

export const API = process.env.SMOKE_API || 'http://127.0.0.1:3174';
/** CORS của sandbox chỉ mở cho đúng host và cổng này. */
export const WEB = process.env.SMOKE_WEB || 'http://127.0.0.1:4999';
/** AI giả lập: đổi chế độ trả lời bằng `?set=`. */
export const MOCK = process.env.SMOKE_MOCK || 'http://127.0.0.1:3175';
export const SHOTS = process.env.SMOKE_SHOTS || resolve(REPO, 'tests/e2e/__shots__/agent-error');
const SHOTS_REL = 'tests/e2e/__shots__/agent-error';
const CHROME = process.env.SMOKE_CHROME || '/usr/bin/google-chrome';

export const PASSWORD = process.env.SMOKE_PASSWORD;
if (!PASSWORD) {
	console.error('Thiếu SMOKE_PASSWORD — đặt mật khẩu sandbox vào biến môi trường rồi chạy lại.');
	process.exit(2);
}

export const WHO = { admin: 'admin@aerr.drill', employee: 'nv@aerr.drill' };

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

// ─── AI giả lập ───────────────────────────────────────────────────────────────
export async function setMode(mode) {
	const res = await fetch(`${MOCK}/__mode?set=${mode}`);
	const body = await res.text();
	return body.trim();
}

// ─── API: nguồn sự thật để so với màn hình ────────────────────────────────────
export async function apiToken(identifier) {
	const res = await fetch(`${API}/v1/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identifier, password: PASSWORD }),
	});
	const json = await res.json();
	if (!res.ok) throw new Error(`Đăng nhập ${identifier} lỗi ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
	return json.data.accessToken;
}

export async function apiMessages(token, conversationId) {
	const res = await fetch(`${API}/v1/agent/conversations/${conversationId}/messages`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	const body = await res.json();
	return body.data ?? [];
}

export async function apiConversations(token) {
	const res = await fetch(`${API}/v1/agent/conversations`, { headers: { Authorization: `Bearer ${token}` } });
	const body = await res.json();
	return body.data ?? [];
}

// ─── Trình duyệt ──────────────────────────────────────────────────────────────
export async function launch() {
	return chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
}

export const PHONE = { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } };

export async function newPage(browser, opts = {}) {
	const ctx = await browser.newContext(opts.phone ? PHONE : { viewport: { width: 1440, height: 900 } });
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

// ─── Khung chat ───────────────────────────────────────────────────────────────
const COMPOSER = 'textarea[placeholder="Nhập câu hỏi cho trợ lý…"]';

/**
 * Hỏi một câu rồi chờ trợ lý trả lời xong.
 *
 * Mốc "xong" là nút gửi quay lại (lúc đang trả lời nó đổi thành nút dừng), chứ không phải một
 * khoảng chờ cứng: lượt lỗi trả về gần như tức thì, còn lượt thành công mất vài giây.
 */
export async function ask(page, question, timeout = 60000) {
	await page.locator(COMPOSER).first().fill(question);
	await page.locator('button[title="Gửi câu hỏi"]').first().click();
	await page.locator('button[title="Gửi câu hỏi"]').first().waitFor({ state: 'visible', timeout });
	await page.waitForTimeout(1500);
}

export async function newConversation(page) {
	await page.getByRole('button', { name: /Hội thoại mới/i }).first().click();
	await page.waitForTimeout(1200);
}

/**
 * Mọi bong bóng của trợ lý đang hiện, kèm việc nó có phải bong bóng lỗi hay không.
 *
 * Bong bóng lỗi nhận ra bằng chính class quyết định màu (`bg-red-50`), tức là đúng thứ người
 * dùng nhìn thấy, chứ không phải một thuộc tính riêng cho bài kiểm.
 */
export async function bubbles(page) {
	return page.evaluate(() =>
		[...document.querySelectorAll('[class*="rounded-tl-md"]')].map(el => ({
			text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
			error: el.className.includes('bg-red-50') || el.className.includes('bg-red-500/10'),
		})),
	);
}

/** Câu hỏi của người dùng, để kiểm thứ tự bong bóng lỗi nằm ngay sau câu hỏi nào. */
export async function chatOrder(page) {
	return page.evaluate(() =>
		[...document.querySelectorAll('[class*="rounded-br-md"], [class*="rounded-tl-md"]')].map(el => ({
			role: el.className.includes('rounded-br-md') ? 'user' : 'assistant',
			text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
			error: el.className.includes('bg-red-50') || el.className.includes('bg-red-500/10'),
		})),
	);
}

/**
 * Mở hội thoại thứ `index` trong danh sách bên trái.
 *
 * Chọn theo VỊ TRÍ chứ không theo tiêu đề: tiêu đề do model đặt từ câu hỏi đầu, nên chạy bài vài
 * lần là có mấy hội thoại trùng tên và bài kiểm mở nhầm cái khác mà vẫn xanh. Vị trí lấy từ
 * `indexOfConversation`, tức là đúng thứ tự API trả và cũng là thứ tự danh sách vẽ ra.
 *
 * Trên điện thoại danh sách nằm trong ngăn kéo, phải mở nút ba gạch trước; ở màn rộng nút đó ẩn
 * nên chờ một nhịp ngắn rồi đi tiếp.
 */
export async function openConversation(page, index) {
	const drawer = page.locator('button[title="Danh sách hội thoại"]').first();
	try {
		await drawer.waitFor({ state: 'visible', timeout: 3000 });
		await drawer.click();
		await page.waitForTimeout(1000);
	} catch {
		// Màn rộng: danh sách đã nằm sẵn bên trái.
	}
	// `:visible` để bỏ qua bản danh sách bị CSS ẩn — trên điện thoại DOM có cả hai bản.
	await page.locator('div[class*="cursor-pointer"][class*="rounded-xl"]:visible').nth(index).click();
	await page.waitForTimeout(2500);
}

/** Vị trí của một hội thoại trong danh sách, đọc từ API để bài kiểm bấm đúng dòng. */
export async function indexOfConversation(token, id) {
	const rows = await apiConversations(token);
	return rows.findIndex(c => c.id === id);
}

/** Họ tên của tài khoản, để tìm đúng dòng người dùng trong bảng thống kê. */
export async function apiFullName(token) {
	const res = await fetch(`${API}/v1/employees/me`, { headers: { Authorization: `Bearer ${token}` } });
	const body = await res.json();
	return body.data?.fullName ?? '';
}

/**
 * Mở màn ADMIN xem lại một hội thoại: bảng thống kê → dòng người dùng → đúng hội thoại.
 *
 * Chọn theo TÊN người và theo số tin nhắn chứ không lấy dòng đầu: bảng xếp theo mức dùng nên dòng
 * đầu thường là người khác, và bài kiểm sẽ xanh nhầm trên hội thoại không phải của ai cần xem.
 */
export async function openTranscript(page, fullName, conversation) {
	await page.locator('table tbody tr', { hasText: fullName }).first().click();
	await page.locator('[data-testid="agent-conversation-list"]').waitFor({ state: 'visible', timeout: 30000 });
	await page.waitForTimeout(1500);
	const byCount = page.locator('[data-testid="agent-conversation-row"]', {
		hasText: `${conversation.messageCount} tin nhắn`,
	});
	const row = (await byCount.count()) > 0 ? byCount : page.locator('[data-testid="agent-conversation-row"]');
	await row.first().click();
	await page.locator('[data-testid="agent-conversation-transcript"]').waitFor({ state: 'visible', timeout: 30000 });
	await page.waitForTimeout(2500);
}

export async function shot(page, name, opts = {}) {
	// Huy hiệu Nuxt devtools chỉ có ở bản dev và nó đè lên đáy màn hình.
	await page
		.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' })
		.catch(() => {});
	const target = opts.selector ? page.locator(opts.selector).first() : page;
	await target.screenshot({ path: `${SHOTS}/${name}.png`, ...(opts.selector ? {} : { fullPage: opts.fullPage ?? false }) });
	return `${SHOTS_REL}/${name}.png`;
}

/** Trang có tràn ngang hay không — thước đo duy nhất đáng tin cho bố cục điện thoại. */
export async function overflow(page) {
	return page.evaluate(() => ({
		scroll: document.documentElement.scrollWidth,
		client: document.documentElement.clientWidth,
	}));
}
