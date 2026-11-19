/**
 * Khung bấm thử lô 1 Hành chính văn phòng: mở Chrome thật, đăng nhập sandbox, ghi lại từng
 * khẳng định và chụp ảnh từng bước.
 *
 * Trình duyệt Playwright tải sẵn lệch bản với repo nên import `playwright-core` bằng đường dẫn
 * tuyệt đối và tự truyền `executablePath` tới Chrome của máy.
 *
 * Mật khẩu và tài khoản đọc lúc chạy từ file sandbox của session BE, không ghi trong bài: mỗi lần
 * dựng lại sandbox là file đó được ghi mới, mà mật khẩu nằm trong file đã commit là thứ cổng bảo
 * mật trước khi commit chặn.
 */
import { chromium, devices } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export const API = 'http://localhost:3190';
export const WEB = 'http://localhost:4030';
export const SHOTS =
	'/home/tuanpham/work/hr-system/.worktrees/fe-office-lot1/tests/e2e/__shots__/office-lot1';
const CHROME = '/usr/bin/google-chrome';
const SANDBOX_FILE =
	'/tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/fd7df120-0745-4bd0-817c-06818b898892/scratchpad/sandbox-office-fe.json';

mkdirSync(SHOTS, { recursive: true });

const sandbox = JSON.parse(readFileSync(SANDBOX_FILE, 'utf8'));

export const PASSWORD = sandbox.password;
export const HCNS_FILE = sandbox.hcnsFile;
export const STH = sandbox.companies.sth;
export const OGO = sandbox.companies.ogo;

/** Người của công ty `sth`, giữ nguyên khoá mà bài đang dùng. */
export const WHO = STH.people;

// ─── Khẳng định ───────────────────────────────────────────────────────────────
const results = [];

export function line(ok, name, detail = '') {
	results.push({ ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

export function summary() {
	const bad = results.filter(r => !r.ok);
	console.log(`\n=== ${results.length - bad.length}/${results.length} khẳng định xanh ===`);
	for (const r of bad) console.log(`  ✗ ${r.name} — ${r.detail}`);
	return bad.length;
}

// ─── API (chỉ để dựng dữ liệu đầu vào và đọc lại trạng thái) ───────────────────
export async function apiToken(email) {
	const res = await fetch(`${API}/v1/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password: PASSWORD }),
	});
	const json = await res.json();
	if (!json?.data?.accessToken) {
		throw new Error(`đăng nhập API thất bại ${email}: ${JSON.stringify(json).slice(0, 200)}`);
	}
	return json.data.accessToken;
}

export async function api(token, path, opts = {}) {
	const res = await fetch(`${API}${path}`, {
		method: opts.method ?? 'GET',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: opts.body,
	});
	const text = await res.text();
	let json = null;
	try {
		json = JSON.parse(text);
	} catch {
		json = null;
	}
	return { status: res.status, json, text };
}

// ─── Trình duyệt ──────────────────────────────────────────────────────────────
export async function launch() {
	return chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
}

export const PHONE = { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } };

/**
 * Mở một tab đã đăng nhập.
 *
 * Đăng nhập qua giao diện thật thay vì nhồi cookie, vì cookie do chính trang đăng nhập ghi và
 * chuyện ghi cookie cũng là thứ cần còn chạy.
 */
export async function signIn(browser, email, opts = {}) {
	const ctx = await browser.newContext(opts.phone ? PHONE : { viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	/** Lỗi JavaScript thật: ngoại lệ chưa bắt và câu console.error của chính app. */
	page.errors = [];
	/** Response 4xx, 5xx kèm URL — nhiều bài cố tình gọi vào đường lỗi nên để riêng, không lẫn. */
	page.apiErrors = [];
	page.on('console', msg => {
		// "Failed to load resource" là Chrome nói về mã HTTP, không phải lỗi của mã nguồn; bài
		// thử đường lỗi (trùng tên, thiếu quyền) luôn sinh ra nó nên lọc ra khỏi lỗi JavaScript.
		if (msg.type() === 'error' && !/Failed to load resource/i.test(msg.text())) page.errors.push(msg.text());
	});
	page.on('pageerror', err => page.errors.push(String(err)));
	page.on('response', res => {
		if (res.status() >= 400) page.apiErrors.push(`${res.status()} ${res.url().replace(API, '')}`);
	});

	await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(1500);
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForTimeout(4000);
	return page;
}

export async function go(page, path, waitMs = 3000) {
	await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(waitMs);
}

export async function text(page) {
	return clean(await page.locator('body').innerText());
}

/** Gộp khoảng trắng để so câu không phụ thuộc cách xuống dòng của màn hình. */
export function clean(s) {
	return String(s).replace(/\s+/g, ' ').trim();
}

export async function shot(page, name) {
	// Huy hiệu Nuxt devtools chỉ có ở bản dev và nó đè lên đáy màn hình, nên ẩn đi để ảnh soát
	// giao diện thấy đúng phần nội dung.
	await page
		.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' })
		.catch(() => {});
	await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
	return `tests/e2e/__shots__/office-lot1/${name}.png`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
const TOAST = 'div.fixed.top-4.right-4 [role="alert"]';

export async function clearToasts(page) {
	// Toast che mất nút ở góc trên phải và cũng chặn click, nên dọn trước mỗi bước.
	await page.evaluate(() => {
		document.querySelectorAll('div.fixed.top-4.right-4 [role="alert"] button').forEach(b => b.click());
	});
	await page.waitForTimeout(400);
}

export async function toastText(page, timeout = 12000) {
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

// ─── Thành phần dùng chung ────────────────────────────────────────────────────
/**
 * `UiSelect` dựng option là <button> teleport ra body, không phải <option>.
 *
 * Bấm bằng `el.click()` trong trang thay vì chuột thật: danh sách option đặt theo toạ độ của nút
 * mở lúc mở, nên khi nút nằm sâu dưới trang thì ô option rơi ra ngoài khung nhìn và chuột thật
 * không bấm tới được, dù người dùng thật vẫn thấy vì họ đã cuộn tới đó.
 */
export async function pickOption(page, label) {
	const option = page.getByRole('button', { name: label, exact: true }).last();
	await option.waitFor({ state: 'attached', timeout: 15000 });
	await option.evaluate(el => el.click());
	await page.waitForTimeout(500);
}

/** Mở ô chọn `UiSelect` theo nhãn rồi chọn một option. */
export async function selectByLabel(scope, page, labelText, optionLabel) {
	const label = scope.locator(`label:text-is("${labelText}")`).last();
	const id = await label.getAttribute('for');
	if (!id) throw new Error(`nhãn "${labelText}" không trỏ tới ô chọn nào`);
	const trigger = scope.locator(`#${id}`);
	await trigger.scrollIntoViewIfNeeded();
	await trigger.click();
	await page.waitForTimeout(400);
	await pickOption(page, optionLabel);
}

/**
 * Chọn option của `UiSelect` thứ `index` trong một phạm vi.
 *
 * Dùng khi nhãn của ô không gắn `for` (trang tự viết nhãn kèm dấu sao bắt buộc): nút mở của
 * `UiSelect` luôn có `id` bắt đầu bằng `ui-select`, nên đếm theo thứ tự trong form là chắc nhất.
 */
export async function selectAt(scope, page, index, optionLabel) {
	const trigger = scope.locator('button[id^="ui-select"]').nth(index);
	await trigger.scrollIntoViewIfNeeded();
	await trigger.click();
	await page.waitForTimeout(400);
	await pickOption(page, optionLabel);
}

/**
 * `UiSelectInput` là ô chọn có sẵn chỗ gõ tìm: bấm vào trigger, gõ, rồi bấm dòng khớp.
 *
 * Dòng gợi ý của nó dựng bằng `v-html` nên chữ bị bọc trong `<mark>`; vì vậy tìm theo text khớp
 * một phần thay vì khớp đúng cả dòng.
 */
export async function pickSearchable(scope, page, triggerIndex, query, optionText) {
	const triggers = scope.locator('div[class*="selectTrigger"]');
	const trigger = triggers.nth(triggerIndex);
	await trigger.scrollIntoViewIfNeeded();
	await trigger.click();
	await page.waitForTimeout(300);
	const search = scope.locator('input[class*="searchInput"]').first();
	await search.fill(query);
	await page.waitForTimeout(600);
	// Nhãn của dòng gợi ý là `<span>` (CSS module nên tên lớp có băm), không phải `<div>`.
	const option = scope.locator('[class*="optionLabel"]', { hasText: optionText }).first();
	await option.waitFor({ state: 'visible', timeout: 8000 });
	await option.click();
	await page.waitForTimeout(400);
}

/**
 * Đặt giờ cho `UiTimeInput` thứ `index` trong một phạm vi.
 *
 * Nút mở của nó là `button.font-mono`, còn danh sách giờ và phút được Teleport ra `body` thành hai
 * cột cuộn; cột giờ là cột đầu, nên phải đi theo cột chứ không bắt theo chữ, vì "05" có ở cả hai.
 */
export async function setTime(scope, page, index, hhmm) {
	const [hh, mm] = hhmm.split(':');
	await scope.locator('button.font-mono').nth(index).click();
	await page.waitForTimeout(500);
	const dropdown = page.locator('div.select-none').last();
	await dropdown.locator('div.flex-1.overflow-y-auto').first().getByRole('button', { name: hh, exact: true }).click();
	await page.waitForTimeout(300);
	await dropdown.locator('div.flex-1.overflow-y-auto').nth(1).getByRole('button', { name: mm, exact: true }).click();
	await page.waitForTimeout(300);
	// Đóng bằng cách bấm ra ngoài, KHÔNG bấm Esc: hộp thoại đặt phòng cũng nghe Esc nên nó sẽ
	// đóng theo và bài mất luôn cái form đang điền.
	await scope.locator('h2').first().click({ position: { x: 2, y: 2 } });
	await page.waitForTimeout(400);
}

/** Hộp thoại đang mở có tiêu đề cho trước. */
export function dialog(page, title) {
	return page.locator('div.fixed.inset-0').filter({ hasText: title }).last();
}

/**
 * Gõ vào ô nhập thường (không phải `UiSelect`) có nhãn cho trước.
 *
 * Ô nhập của các trang này đứng ngay sau nhãn của nó, nên lấy phần tử `input` hoặc `textarea` đầu
 * tiên phía sau nhãn; cách này không phụ thuộc div bọc ngoài như lọc theo `has`.
 */
export async function fillByLabel(scope, labelText, value) {
	const label = scope.locator(`label:has-text("${labelText}")`).first();
	await label.locator('xpath=following::*[self::input or self::textarea][1]').fill(value);
}

/** Ngày dạng `dd/mm/yyyy` để gõ vào `UiDatePicker`. */
export function viDate(at) {
	const d = at instanceof Date ? at : new Date(at);
	return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function daysFromNow(days) {
	return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * Chỗ các bài nối nhau trao lại kỳ đang làm việc.
 *
 * `smoke-period-flow.mjs` khoá một kỳ rồi `smoke-period-flow2.mjs` đi tiếp trên chính kỳ đó. Đoán
 * bằng "kỳ mới nhất" hay "kỳ đã khoá có dòng" đều sai khi sandbox có hàng chục kỳ của các bài
 * khác, nên bài trước ghi thẳng id ra đây cho bài sau. File nằm trong thư mục ảnh (đã .gitignore).
 */
const CHAIN_STATE = `${SHOTS}/.chain-state.json`;

export function saveChainState(patch) {
	const current = readChainState();
	writeFileSync(CHAIN_STATE, JSON.stringify({ ...current, ...patch }, null, '\t'));
}

export function readChainState() {
	try {
		return JSON.parse(readFileSync(CHAIN_STATE, 'utf8'));
	} catch {
		// Chưa có file, hoặc file hỏng: bài sau tự đi tìm như trước.
		return {};
	}
}

/**
 * Tìm phiếu của chính mình có đủ những dòng cho trước, ưu tiên phiếu mới nhất.
 *
 * Sandbox nay có nhiều kỳ do nhiều bài mở, nên "kỳ có id lớn nhất" không còn là kỳ của bài: phải
 * tìm theo DỮ LIỆU mà bài cần (những dòng `smoke-supplies.mjs` đã nhập), nếu không bài sẽ bấm vào
 * một phiếu của bài khác rồi gãy ở giữa.
 *
 * @param {string} token token của nhân viên sở hữu phiếu
 * @param {RegExp[]} patterns tên dòng phải có mặt
 * @param {{ status?: string, requestStatus?: string }} [opts] trạng thái kỳ và trạng thái phiếu
 *   cần khớp, ví dụ kỳ `OPEN`, hoặc kỳ `LOCKED` với phiếu còn `LOCKED` (chưa chốt)
 */
export async function findRequestWithLines(token, patterns, opts = {}) {
	const list = (await api(token, '/v1/me/office/supply-requests')).json?.data ?? [];
	const candidates = list
		.filter(r => !r.isSupplement && r.lineCount >= patterns.length)
		.filter(r => !opts.status || r.period?.status === opts.status)
		.filter(r => !opts.requestStatus || r.status === opts.requestStatus)
		.sort((a, b) => b.id - a.id);
	for (const item of candidates) {
		const detail = (await api(token, `/v1/me/office/supply-requests/${item.id}`)).json?.data;
		const names = (detail?.lines ?? []).map(l => l.name);
		if (patterns.every(pattern => names.some(name => pattern.test(name)))) return { item, detail };
	}
	return { item: null, detail: null };
}

/** `YYYY-MM-DD` giờ máy, dùng khi cần so với dữ liệu API. */
export function ymd(at = new Date()) {
	const d = at instanceof Date ? at : new Date(at);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
