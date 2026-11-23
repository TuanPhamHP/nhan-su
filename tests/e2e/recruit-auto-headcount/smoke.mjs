/**
 * Bấm thử "tự gom định biên" (23/11/2026) trên sandbox tuyển dụng của session BE: yêu cầu tuyển
 * không còn bị chặn vì định biên, duyệt bước cuối tự tăng hoặc tự tạo định biên.
 *
 * Chạy: node tests/e2e/recruit-auto-headcount/smoke.mjs (web 4997 và API 3191 phải đang chạy).
 * Bài GHI dữ liệu sandbox (gửi duyệt A, B; duyệt C, D, E), nên chỉ chạy được một lần sau mỗi
 * lần dựng lại sandbox.
 *
 * Tài khoản, mật khẩu và mã yêu cầu đọc lúc chạy từ file sandbox, không ghi trong bài.
 */
import { chromium, devices } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';

const SANDBOX = JSON.parse(
	readFileSync('/home/tuanpham/work/hr-system/.sandbox-recruit/sandbox-recruit.json', 'utf8'),
);
const API = SANDBOX.api; // …/v1
const WEB = SANDBOX.web.origin;
const YEAR = SANDBOX.year;
const REQ = SANDBOX.requisitions;
const ACC = SANDBOX.accounts;
const BACKEND = 'Lập trình viên Backend';
const FORM_ONLY = process.argv.includes('--form-only');
const F10_ONLY = process.argv.includes('--f10-only');

const results = [];
function line(ok, name, detail = '') {
	results.push({ ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

// ─── API: chỉ đọc lại trạng thái để đối chiếu ─────────────────────────────────
async function apiToken(email) {
	const res = await fetch(`${API}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password: SANDBOX.password }),
	});
	const json = await res.json();
	if (!json?.data?.accessToken) throw new Error(`đăng nhập API thất bại ${email}`);
	return json.data.accessToken;
}
async function apiGet(token, path) {
	const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
	return res.json();
}
const headcountRows = token => apiGet(token, `/recruitment/headcount-plans?year=${YEAR}`).then(j => j.data ?? []);
const rowOf = (rows, name) => rows.find(r => r.position?.name === name);

// ─── Trình duyệt ──────────────────────────────────────────────────────────────
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const PHONE = { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } };

async function signIn(email, phone = false) {
	const ctx = await browser.newContext(phone ? PHONE : { viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	page.errors = [];
	page.on('pageerror', err => page.errors.push(String(err)));
	page.on('console', msg => {
		if (msg.type() === 'error' && !/Failed to load resource/i.test(msg.text())) page.errors.push(msg.text());
	});
	await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(1500);
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(SANDBOX.password);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForTimeout(2500);
	const pick = page.locator('[data-company-code="rec"]');
	if (await pick.count()) {
		await pick.first().click();
		await page.waitForTimeout(2500);
	}
	return page;
}

async function goto(page, path) {
	await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(2500);
}

/** Tràn ngang: trang cuộn ngang được, hoặc có phần tử hiện ra vượt mép phải khung nhìn. */
async function overflow(page) {
	return page.evaluate(() => {
		const vw = document.documentElement.clientWidth;
		const docOver = document.documentElement.scrollWidth - vw;
		const wide = [...document.querySelectorAll('body *')]
			.filter(el => {
				const r = el.getBoundingClientRect();
				if (!r.width || !r.height) return false;
				// Phần tử nằm trong khung cuộn ngang riêng (bảng) thì không tính.
				for (let p = el.parentElement; p; p = p.parentElement) {
					const s = getComputedStyle(p);
					if (/(auto|scroll|hidden)/.test(s.overflowX) && p !== document.body && p !== document.documentElement) {
						const pr = p.getBoundingClientRect();
						if (pr.right <= vw + 1) return false;
					}
				}
				return r.right > vw + 1;
			})
			.slice(0, 3)
			.map(el => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
		return { docOver, wide };
	});
}

async function openCreateForm(page) {
	await goto(page, '/management/recruitment/requisitions');
	await page.getByRole('button', { name: /Tạo yêu cầu/ }).first().click();
	await page.waitForTimeout(800);
	return page.locator('form').filter({ hasText: 'Vị trí cần tuyển' }).first();
}

async function pickPosition(page, form, name) {
	await form.locator('button', { hasText: /Chọn vị trí|—/ }).first().click();
	await page.waitForTimeout(300);
	await page.locator('body > div button', { hasText: new RegExp(`^\\s*${name} —`) }).first().click();
	await page.waitForTimeout(1500);
}

try {
	const hrToken = await apiToken(ACC.hr.email);

	// `--f10-only`: chỉ chạy F10, bài chỉ đọc nên chạy lại được sau lần chạy đầy đủ.
	if (!F10_ONLY) {

	// ─── F1, F2: form tạo yêu cầu (HR) ────────────────────────────────────────
	{
		const page = await signIn(ACC.hr.email);
		const form = await openCreateForm(page);
		await pickPosition(page, form, 'DevOps');
		const block = form.locator('div.rounded-lg.border').filter({ hasText: /định biên/ }).first();
		const text = (await block.innerText()).replace(/\s+/g, ' ');
		const cls = (await block.getAttribute('class')) ?? '';
		line(
			text.includes(`Vị trí này chưa có định biên năm ${YEAR}. Bạn vẫn gửi duyệt được`) &&
				text.includes('hệ thống sẽ tự tạo định biên'),
			'F1 DevOps chưa có định biên: câu "vẫn gửi duyệt được… tự tạo định biên"',
			text,
		);
		line(/sky-50/.test(cls) && !/amber/.test(cls), 'F1 khối tông xanh, không hổ phách', cls.match(/bg-\S+/)?.[0] ?? cls);

		// Từ vòng 2, "đang tuyển" chỉ tính yêu cầu đã duyệt, nên C đang chờ không chiếm chỗ:
		// Backend còn trống 1, xin 3 thì thiếu 2.
		await pickPosition(page, form, BACKEND);
		await form.locator('input[type="number"]').first().fill('3');
		await page.waitForTimeout(500);
		const text2 = (await block.innerText()).replace(/\s+/g, ' ');
		line(
			text2.includes('còn trống 1 người') &&
				text2.includes('Số lượng xin nhiều hơn phần còn trống 2 người. Bạn vẫn gửi duyệt được') &&
				text2.includes('tự tăng thêm khoảng 2 người'),
			'F2 Backend xin 3, còn trống 1: câu "nhiều hơn… 2 người… khoảng 2"',
			text2,
		);
		const submitBtn = form.getByRole('button', { name: 'Tạo bản nháp' });
		line(await submitBtn.isEnabled(), 'F2 nút Tạo bản nháp bấm được');
		line(!page.errors.length, 'F1–F2 không lỗi JavaScript', page.errors.slice(0, 2).join(' | '));
		await page.context().close();
	}

	// ─── F8 (form): 390 px ────────────────────────────────────────────────────
	{
		const page = await signIn(ACC.hr.email, true);
		const form = await openCreateForm(page);
		await pickPosition(page, form, BACKEND);
		await form.locator('input[type="number"]').first().fill('3');
		await page.waitForTimeout(600);
		const o = await overflow(page);
		line(o.docOver <= 0 && !o.wide.length, 'F8 form 390 px không tràn ngang', JSON.stringify(o));
		await page.context().close();
	}

	// `--form-only`: dừng ở đây, chưa ghi gì vào sandbox (để soát bộ chọn trước lần chạy thật).
	if (!FORM_ONLY) {

	// ─── F3: gửi duyệt A và B (HR) ────────────────────────────────────────────
	{
		const page = await signIn(ACC.hr.email);
		for (const [key, r] of [['A', REQ.A_draftNoPlan], ['B', REQ.B_draftExceed]]) {
			await goto(page, `/management/recruitment/requisitions/${r.id}`);
			const info = page.locator('div.rounded-xl').filter({ hasText: /định biên sẽ tự|tự tạo định biên/ }).first();
			const infoText = (await info.count()) ? (await info.innerText()).replace(/\s+/g, ' ') : '(không có khối)';
			const btn = page.getByRole('button', { name: 'Gửi duyệt' });
			const enabled = (await btn.count()) > 0 && (await btn.first().isEnabled());
			line(enabled && !/bị chặn/.test(await page.locator('main').innerText()), `F3 ${key} nút Gửi duyệt không khoá, không có chữ "bị chặn"`, infoText);
			if (enabled) {
				await btn.first().click();
				await page.waitForTimeout(2500);
			}
			const after = await apiGet(hrToken, `/recruitment/requisitions/${r.id}`);
			line(after.data?.status === 'PENDING', `F3 ${key} (${r.code}) sau Gửi duyệt là Chờ duyệt`, after.data?.status ?? JSON.stringify(after).slice(0, 120));
		}
		line(!page.errors.length, 'F3 không lỗi JavaScript', page.errors.slice(0, 2).join(' | '));
		await page.context().close();
	}

	// ─── F8 (Chờ duyệt): 390 px, trước khi tp duyệt C ─────────────────────────
	{
		const page = await signIn(ACC.manager.email, true);
		await goto(page, '/management/recruitment/approvals');
		const o = await overflow(page);
		line(o.docOver <= 0 && !o.wide.length, 'F8 trang Chờ duyệt 390 px không tràn ngang', JSON.stringify(o));
		await page.context().close();
	}

	// ─── F4: tp duyệt C ở bước 1 ──────────────────────────────────────────────
	{
		const page = await signIn(ACC.manager.email);
		await goto(page, '/management/recruitment/approvals');
		const card = page.locator('li').filter({ hasText: REQ.C_pendingStep1.code }).first();
		const text = (await card.innerText()).replace(/\s+/g, ' ');
		line(
			text.includes('Xin 4, định biên còn trống 1. Duyệt xong bước cuối, định biên sẽ tự tăng thêm khoảng 3 người.') &&
				!/bị chặn/.test(text),
			'F4 thẻ C: "Xin 4, còn trống 1… thêm khoảng 3", không nói "bị chặn"',
			text.slice(0, 260),
		);
		const approve = card.getByRole('button', { name: 'Duyệt', exact: true });
		line(await approve.isEnabled(), 'F4 nút Duyệt bấm được');
		await approve.click();
		await page.waitForTimeout(2500);
		const after = await apiGet(hrToken, `/recruitment/requisitions/${REQ.C_pendingStep1.id}`);
		const steps = after.data?.approvalSteps ?? after.data?.steps ?? [];
		const step1 = steps.find(s => s.level === 1);
		line(
			after.data?.status === 'PENDING' && (step1 ? step1.status === 'APPROVED' : true),
			'F4 C duyệt bước 1 thành công, chuyển sang bước 2',
			`status=${after.data?.status} step1=${step1?.status ?? '?'}`,
		);
		line(!page.errors.length, 'F4 không lỗi JavaScript', page.errors.slice(0, 2).join(' | '));
		await page.context().close();
	}

	// ─── F5, F6: hr duyệt D và E ở bước cuối ──────────────────────────────────
	{
		const before = await headcountRows(hrToken);
		const testerBefore = rowOf(before, 'Kiểm thử');
		const testerChangesBefore = testerBefore
			? (await apiGet(hrToken, `/recruitment/headcount-plans/${testerBefore.id}/changes`)).data?.length
			: null;
		line(!rowOf(before, 'DevOps')?.confirmedQuantity, 'F5 trước: DevOps chưa có định biên đã chốt', JSON.stringify(rowOf(before, 'DevOps')?.confirmedQuantity ?? null));

		const page = await signIn(ACC.hr.email);
		await goto(page, '/management/recruitment/approvals');
		for (const [key, r] of [['D', REQ.D_pendingFinalNoPlan], ['E', REQ.E_pendingFinalWithin]]) {
			const card = page.locator('li').filter({ hasText: r.code }).first();
			const approve = card.getByRole('button', { name: 'Duyệt', exact: true });
			line((await card.count()) > 0 && (await approve.isEnabled()), `F${key === 'D' ? 5 : 6} thẻ ${key} có nút Duyệt bấm được`, (await card.innerText()).replace(/\s+/g, ' ').slice(0, 200));
			await approve.click();
			await page.waitForTimeout(3000);
			const after = await apiGet(hrToken, `/recruitment/requisitions/${r.id}`);
			line(after.data?.status === 'APPROVED', `F${key === 'D' ? 5 : 6} ${key} (${r.code}) duyệt xong là Đã duyệt`, after.data?.status);
		}

		const after = await headcountRows(hrToken);
		const devops = rowOf(after, 'DevOps');
		line(devops?.confirmedQuantity === 1, 'F5 API: DevOps có định biên đã chốt 1', JSON.stringify(devops ? { confirmed: devops.confirmedQuantity, status: devops.status } : null));
		const tester = rowOf(after, 'Kiểm thử');
		const testerChangesAfter = tester
			? (await apiGet(hrToken, `/recruitment/headcount-plans/${tester.id}/changes`)).data?.length
			: null;
		line(tester?.confirmedQuantity === 5 && testerChangesAfter === testerChangesBefore, 'F6 Kiểm thử giữ 5, lịch sử không thêm dòng', `confirmed=${tester?.confirmedQuantity} changes ${testerChangesBefore}→${testerChangesAfter}`);

		// Trang Định biên năm, dòng DevOps và lịch sử của nó.
		await goto(page, `/management/recruitment/headcount?year=${YEAR}`);
		const tr = page.locator('tr').filter({ hasText: 'DevOps' }).first();
		const trText = (await tr.innerText()).replace(/\s+/g, ' ');
		line(/Đã chốt/.test(trText) && /\b1\b/.test(trText), 'F5 trang Định biên có dòng DevOps đã chốt', trText);
		// A (DevOps xin 2) đang chờ không còn tính vào đang tuyển, nên dòng vừa tự tạo không bị gắn vượt.
		line(!/Vượt định biên|bị chặn/.test(trText), 'F5 dòng DevOps không bị gắn "Vượt định biên"', trText);
		await tr.getByRole('button', { name: 'Lịch sử' }).click();
		await page.waitForTimeout(1500);
		const modal = page.locator('div.rounded-2xl').filter({ hasText: 'Lịch sử định biên' }).first();
		const mText = (await modal.innerText()).replace(/\s+/g, ' ');
		line(
			mText.includes('Tăng theo yêu cầu tuyển') && mText.includes(REQ.D_pendingFinalNoPlan.code),
			'F5 lịch sử DevOps có dòng "Tăng theo yêu cầu tuyển" kèm mã yêu cầu D',
			mText.slice(0, 240),
		);
		line(!page.errors.length, 'F5–F6 không lỗi JavaScript', page.errors.slice(0, 2).join(' | '));
		await page.context().close();
	}

	// ─── F7: gd thấy N-19 và bấm mở đúng trang ────────────────────────────────
	{
		const page = await signIn(ACC.director.email);
		await goto(page, '/management');
		await page.locator('[data-notif-panel] button[title="Thông báo"]').click();
		await page.waitForTimeout(2000);
		const panel = page.locator('body');
		const item = panel.getByText(/Định biên tăng theo yêu cầu tuyển/).first();
		const found = (await item.count()) > 0;
		line(found, 'F7 chuông có thông báo "Định biên tăng theo yêu cầu tuyển dụng"', found ? (await item.innerText()).replace(/\s+/g, ' ') : (await panel.innerText()).replace(/\s+/g, ' ').slice(0, 240));
		if (found) {
			await item.click();
			await page.waitForTimeout(3000);
			const url = new URL(page.url());
			line(
				url.pathname === '/management/recruitment/headcount' && url.searchParams.get('year') === String(YEAR),
				`F7 bấm mở đúng trang Định biên năm ${YEAR}`,
				page.url().replace(WEB, ''),
			);
		}
		line(!page.errors.length, 'F7 không lỗi JavaScript', page.errors.slice(0, 2).join(' | '));
		await page.context().close();
	}

	}
	}

	if (!FORM_ONLY) {
	// ─── F10: hộp xoá dòng đang dùng có câu mới. Chỉ mở rồi đóng, KHÔNG xoá. ────
	// Dòng đã chốt chỉ người có quyền chốt định biên xoá được, nên dùng gd chứ không phải hr.
	{
		const page = await signIn(ACC.director.email);
		await goto(page, `/management/recruitment/headcount?year=${YEAR}`);
		const tr = page.locator('tr').filter({ hasText: BACKEND }).first();
		const del = tr.getByRole('button', { name: 'Xoá', exact: true });
		if (!(await del.count())) {
			line(false, 'F10 dòng Backend có nút Xoá cho người có quyền chốt',(await tr.innerText()).replace(/\s+/g, ' '));
		} else {
			await del.click();
			await page.waitForTimeout(1000);
			const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
			line(
				body.includes(
					'Yêu cầu nháp và yêu cầu chờ duyệt vẫn gửi, duyệt được. Khi một yêu cầu được duyệt xong, định biên của vị trí sẽ được tạo lại.',
				) && !body.includes('sẽ không gửi duyệt được'),
				'F10 hộp xoá dòng có câu mới, không còn câu "không gửi duyệt được"',
				body.match(/Xoá dòng định biên.{0,400}/)?.[0] ?? '(không thấy hộp)',
			);
			await page.keyboard.press('Escape');
			await page.waitForTimeout(400);
			const cancel = page.getByRole('button', { name: /^Huỷ$/ });
			if (await cancel.count()) await cancel.first().click();
			await page.waitForTimeout(800);
			const still = rowOf(await headcountRows(hrToken), BACKEND);
			line(!!still, 'F10 đóng hộp, dòng Backend vẫn còn');
		}
		line(!page.errors.length, 'F10 không lỗi JavaScript', page.errors.slice(0, 2).join(' | '));
		await page.context().close();
	}
	}
} catch (e) {
	line(false, 'Bài dừng giữa chừng', String(e?.stack ?? e).slice(0, 400));
} finally {
	await browser.close();
}

const bad = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - bad.length}/${results.length} khẳng định xanh ===`);
for (const r of bad) console.log(`  ✗ ${r.name} — ${r.detail}`);
process.exitCode = bad.length ? 1 : 0;
