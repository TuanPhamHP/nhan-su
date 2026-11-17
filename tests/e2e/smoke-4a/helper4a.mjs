/**
 * Khung bấm thử lô 4a: mở trình duyệt thật, đăng nhập sandbox, và ghi lại từng khẳng định.
 *
 * Trình duyệt Playwright tải sẵn lệch bản với repo nên import `playwright-core` bằng đường dẫn
 * tuyệt đối và tự truyền `executablePath` tới Chrome của máy.
 */
import { chromium, devices } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

export const API = 'http://localhost:3170';
export const WEB = 'http://localhost:4020';
export const SHOTS = '/home/tuanpham/work/hr-system/.worktrees/fe-approval/tests/e2e/__shots__/approval-4a';
const CHROME = '/usr/bin/google-chrome';
const SANDBOX_FILE = '/home/tuanpham/work/hr-system/.sandbox-4a/sandbox-4a.json';

mkdirSync(SHOTS, { recursive: true });

/**
 * Mật khẩu và tài khoản đọc lúc chạy từ file sandbox của session BE, không ghi trong bài.
 *
 * Thư mục này nằm trong worktree nên có thể bị stage nhầm, mà mật khẩu nằm trong file đã commit
 * là thứ cổng bảo mật trước khi commit chặn. Đọc lúc chạy còn đúng hơn: mỗi lần dựng lại sandbox
 * là file đó được ghi mới.
 */
const sandbox = JSON.parse(readFileSync(SANDBOX_FILE, 'utf8'));

export const PASSWORD = sandbox.password;

/** Người của công ty `cta` trên sandbox, giữ nguyên các khoá mà bài đang dùng. */
export const WHO = Object.fromEntries(
	Object.entries(sandbox.people).map(([key, p]) => [key, { email: p.email, id: p.id, name: p.name }]),
);

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

// ─── API ──────────────────────────────────────────────────────────────────────
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

/** Giá trị biểu mẫu hợp lệ của mẫu "Tờ trình BGĐ" (id 1), đủ mọi trường bắt buộc. */
export function proposalValues(extra = {}) {
	return {
		so_to_trinh: '01/TTr-KD',
		ten_cong_ty: 'Công ty A',
		phong_ban: 'Kinh doanh',
		ngay_van_ban: '2026-11-16',
		ve_viec: 'Mua máy tính cho phòng kinh doanh',
		can_cu_1: 'Kế hoạch kinh doanh năm 2026',
		noi_dung: 'Phòng kinh doanh đề nghị mua hai máy tính để bàn cho nhân viên mới.',
		ten_giam_doc: 'Trần Văn Bình',
		ten_nguoi_de_nghi: 'Trịnh Văn Long',
		...extra,
	};
}

/**
 * Dựng sẵn một phiếu đã gửi bằng API, để bài bấm thử tập trung vào thao tác trên màn.
 *
 * Chỉ dựng dữ liệu đầu vào; mọi quyết định (đồng ý, từ chối, trả lại, chuyển lượt) vẫn bấm thật
 * trên giao diện, vì đó mới là thứ cần kiểm.
 */
export async function seedRequest(token, { templateId = 1, title, fieldValues, pickedApprovers, watcherIds }) {
	const created = await api(token, '/v1/general-requests', {
		method: 'POST',
		body: JSON.stringify({ templateId, title, fieldValues: fieldValues ?? proposalValues() }),
	});
	const id = created.json?.data?.id;
	if (!id) throw new Error(`không tạo được phiếu nháp: ${created.status} ${created.text.slice(0, 200)}`);
	if (!pickedApprovers) return { id, code: null, status: created.status, detail: created.json.data };
	const submitted = await api(token, `/v1/general-requests/${id}/submit`, {
		method: 'PATCH',
		body: JSON.stringify({ pickedApprovers, watcherIds }),
	});
	if (submitted.status !== 200) throw new Error(`không gửi được phiếu ${id}: ${submitted.status} ${submitted.text.slice(0, 300)}`);
	return { id, code: submitted.json?.data?.code, status: submitted.status, detail: submitted.json.data };
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
	page.errors = [];
	page.on('console', msg => {
		if (msg.type() === 'error') page.errors.push(msg.text());
	});
	page.on('pageerror', err => page.errors.push(String(err)));

	await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(1200);
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForTimeout(3500);
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
	return `tests/e2e/__shots__/approval-4a/${name}.png`;
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
 * Bấm bằng `el.click()` trong trang thay vì chuột thật: danh sách option được đặt theo toạ độ
 * của nút mở lúc mở, nên khi nút nằm sâu dưới trang thì ô option rơi ra ngoài khung nhìn và
 * chuột thật không bấm tới được, dù người dùng thật vẫn thấy vì họ đã cuộn tới đó.
 */
export async function pickOption(page, label) {
	const option = page.getByRole('button', { name: label, exact: true }).last();
	await option.waitFor({ state: 'attached', timeout: 15000 });
	await option.evaluate(el => el.click());
	await page.waitForTimeout(500);
}

/**
 * Mở ô chọn `UiSelect` theo nhãn rồi chọn một option.
 *
 * `UiSelect` gắn nhãn với nút mở bằng `label[for]` → `button#id`, nên đi theo thuộc tính `for`
 * là cách chắc nhất, không phụ thuộc cây div bọc ngoài.
 */
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

/** Nút mở của một `UiSelect` theo nhãn, khi cần đọc chữ đang chọn. */
export async function selectTrigger(scope, labelText) {
	const label = scope.locator(`label:text-is("${labelText}")`).last();
	const id = await label.getAttribute('for');
	return scope.locator(`#${id}`);
}

/**
 * Gốc của một ô chọn người (`EmployeePicker`) theo nhãn: thẻ cha của nhãn.
 *
 * Trong đó có thẻ tên đã chọn, ô gõ tìm và danh sách gợi ý.
 */
export function pickerBox(scope, labelText) {
	return scope.locator(`label:text-is("${labelText}")`).locator('xpath=..');
}

/**
 * Chọn một người trong ô chọn người, và chỉ coi là xong khi thẻ tên đã hiện.
 *
 * Thử lại vài lần vì danh sách gợi ý lọc theo chữ đang gõ: cú bấm đầu đôi khi rơi vào lúc danh
 * sách vừa dựng lại, và lúc đó không có gì thay đổi trên màn để chờ.
 */
export async function pickPerson(box, page, fullName) {
	const input = box.locator('input[type="text"]').last();
	const chip = box.getByRole('button', { name: `Bỏ chọn ${fullName}` });
	for (let attempt = 0; attempt < 3; attempt++) {
		await input.fill(fullName);
		await page.waitForTimeout(700);
		const option = box.getByRole('button', { name: new RegExp(fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first();
		if (await option.count()) await option.click();
		await page.waitForTimeout(800);
		if (await chip.count()) return true;
	}
	return false;
}


/** Thẻ (card) chứa tiêu đề cho trước, để giới hạn phạm vi tìm. */
export function card(page, title) {
	return page.locator('section, div').filter({ hasText: title }).last();
}

/** Hộp thoại đang mở có tiêu đề cho trước. */
export function dialog(page, title) {
	return page.locator('div.fixed.inset-0').filter({ hasText: title }).last();
}

/**
 * Gõ vào ô nhập thường (không phải `UiSelect`) có nhãn cho trước.
 *
 * Ô nhập của các trang này đứng ngay sau nhãn của nó, nên lấy phần tử `input` hoặc `textarea`
 * đầu tiên phía sau nhãn; cách này không phụ thuộc div bọc ngoài như lọc theo `has`.
 */
export async function fillByLabel(scope, labelText, value) {
	const label = scope.locator(`label:has-text("${labelText}")`).first();
	await label.locator('xpath=following::*[self::input or self::textarea][1]').fill(value);
}
