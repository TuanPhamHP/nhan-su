/**
 * Chụp + ĐO block `table` của trợ lý trong khung chat — desktop và mobile.
 *
 * Khác `agent-chart-shots.mjs`: script này KHÔNG cần backend và KHÔNG cần khoá LLM.
 * Mọi request `/v1/**` đều bị Playwright chặn lại và trả dữ liệu giả ĐÚNG SHAPE trong
 * `docs/backend/bridges/ai-agent.md`. Nhờ vậy nó kiểm được phần duy nhất thuộc về FE:
 * bảng có hiện ra không, có đủ dòng không, có cuộn được không, có vỡ layout trên điện
 * thoại không — những thứ không test backend nào thấy được.
 *
 * Giới hạn phải nhớ: dữ liệu là GIẢ. Script này KHÔNG chứng minh tool thật trả đúng số,
 * cũng không chứng minh model gọi đúng tool. Nó chỉ chứng minh FE vẽ đúng cái server gửi.
 *
 * ── Cách chạy ────────────────────────────────────────────────────────────────
 *
 * 1) Nuxt dev (API trỏ vào đâu không quan trọng — mọi call đều bị chặn):
 *      sed 's|^NUXT_PUBLIC_BASE_API_URL=.*|NUXT_PUBLIC_BASE_API_URL=http://localhost:3999|' \
 *        .env > /tmp/env.pw
 *      npx nuxt dev --dotenv /tmp/env.pw --port 4100
 *
 * 2) Chụp:
 *      node tests/e2e/agent-table-shots.mjs
 *
 * Biến môi trường: `BASE_URL` (mặc định http://localhost:4100), `SHOTS_DIR`
 * (mặc định tests/e2e/__shots__), `CHROME_PATH` (mặc định /usr/bin/google-chrome).
 */
import { chromium, devices } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.SHOTS_DIR || resolve(HERE, '__shots__');
const BASE = process.env.BASE_URL || 'http://localhost:4100';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

// ── Dữ liệu giả — ĐÚNG shape bridge doc, không thêm trường nào tự nghĩ ra ─────

const COLUMNS = [
	{ key: 'date', label: 'Ngày' },
	{ key: 'status', label: 'Trạng thái' },
	{ key: 'checkIn', label: 'Giờ vào' },
	{ key: 'checkOut', label: 'Giờ ra' },
	{ key: 'issue', label: 'Ghi nhận' },
];

const SHORT_TABLE = {
	title: 'Ngày cần lưu ý — tháng 9/2026',
	columns: COLUMNS,
	rows: [
		{ date: '03/09/2026 (T5)', status: 'Đi muộn', checkIn: '08:17', checkOut: '17:35', issue: 'Muộn 17 phút' },
		{ date: '11/09/2026 (T6)', status: 'Có mặt', checkIn: '08:05', checkOut: '—', issue: 'Thiếu giờ ra' },
		{ date: '18/09/2026 (T6)', status: 'Vắng', checkIn: '—', checkOut: '—', issue: 'Không có dữ liệu chấm công' },
	],
	source: '3 ngày có phát sinh',
};

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const LONG_ROWS = 30;
const LONG_TABLE = {
	title: `Ngày cần lưu ý — tháng 8/2026 (${LONG_ROWS} dòng)`,
	columns: COLUMNS,
	rows: Array.from({ length: LONG_ROWS }, (_, i) => ({
		date: `${String(i + 1).padStart(2, '0')}/08/2026 (${DAYS[i % 7]})`,
		status: i % 3 === 0 ? 'Đi muộn' : i % 3 === 1 ? 'Về sớm' : 'Thiếu chấm công',
		checkIn: i % 3 === 2 ? '—' : `08:${String(10 + (i % 40)).padStart(2, '0')}`,
		checkOut: i % 3 === 1 ? `16:${String(10 + (i % 40)).padStart(2, '0')}` : '17:35',
		issue: i % 3 === 0 ? `Muộn ${i + 1} phút` : i % 3 === 1 ? `Sớm ${i + 2} phút` : 'Thiếu giờ vào',
	})),
	source: `${LONG_ROWS} ngày có phát sinh`,
};

const CHART = {
	type: 'bar',
	title: 'Đi muộn và vắng theo tháng',
	labels: ['Tháng 7', 'Tháng 8', 'Tháng 9'],
	series: [
		{ name: 'Đi muộn', data: [3, 10, 7] },
		{ name: 'Vắng', data: [0, 1, 2] },
	],
	unit: 'ngày',
	source: '3 tháng gần nhất',
};

/** Một lượt trả lời = danh sách event SSE y như backend phát. */
const TURNS = [
	{
		key: '01-bang-ngan',
		ask: 'tháng trước tôi đi muộn những ngày nào',
		events: [
			{ type: 'delta', text: 'Tháng 9/2026 bạn có 3 ngày cần lưu ý. Chi tiết ở bảng dưới.' },
			{ type: 'table', tool: 'attendance_listMyIrregularDays', table: SHORT_TABLE },
		],
		expect: { tables: 1, charts: 0 },
	},
	{
		key: '02-khong-co-bang',
		ask: 'tháng 7 tôi đi muộn ngày nào',
		events: [
			{ type: 'delta', text: 'Tháng 7/2026 bạn không có ngày nào đi muộn hay thiếu chấm công.' },
		],
		expect: { tables: 0, charts: 0 },
	},
	{
		key: '03-bang-30-dong',
		ask: 'cho tôi xem từng ngày bất thường tháng 8',
		events: [
			{ type: 'delta', text: `Tháng 8/2026 có ${LONG_ROWS} ngày cần lưu ý.` },
			{ type: 'table', tool: 'attendance_listMyIrregularDays', table: LONG_TABLE },
		],
		expect: { tables: 1, charts: 0, rows: LONG_ROWS },
	},
	{
		key: '04-chart-va-table',
		ask: 'thống kê chuyên cần 3 tháng gần nhất kèm chi tiết',
		events: [
			{ type: 'delta', text: 'Ba tháng gần nhất bạn đi muộn 20 lần, vắng 3 ngày.' },
			{ type: 'chart', tool: 'report_getAttendance', chart: CHART },
			{ type: 'table', tool: 'attendance_listMyIrregularDays', table: SHORT_TABLE },
		],
		expect: { tables: 1, charts: 1 },
	},
];

/** Hội thoại cũ — bảng nằm trong message đã lưu, không đi qua SSE. */
const HISTORY = [
	{ id: 101, role: 'user', text: 'tháng trước tôi đi muộn những ngày nào', createdAt: '2026-10-01T02:00:00.000Z' },
	{
		id: 102,
		role: 'assistant',
		text: 'Tháng 9/2026 bạn có 3 ngày cần lưu ý. Chi tiết ở bảng dưới.',
		tables: [SHORT_TABLE],
		createdAt: '2026-10-01T02:00:05.000Z',
	},
];

const CONVERSATIONS = [
	{ id: 12, title: 'Ngày đi muộn tháng 9', lastMessageAt: '2026-10-01T02:00:05.000Z', createdAt: '2026-10-01T02:00:00.000Z', messageCount: 2 },
];

const EMPLOYEE = {
	id: 2,
	fullName: 'Nguyễn Văn Smoke',
	email: 'smoke@test.local',
	employeeCode: 'EMP002',
	role: 'EMPLOYEE',
	avatarUrl: null,
	department: null,
};

const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-headers': '*',
	'access-control-allow-methods': '*',
};

function sse(events, conversationId = 12) {
	const frames = events.map(
		(e) => `event: ${e.type}\ndata: ${JSON.stringify({ ...e, conversationId })}\n\n`,
	);
	frames.push(
		`event: done\ndata: ${JSON.stringify({
			conversationId,
			messageId: 999,
			answer: '',
			playbookId: null,
			routerTier: 'RULE',
			toolsCalled: events.filter((e) => e.tool).map((e) => e.tool),
			usage: { promptTokens: 0, completionTokens: 0, cachedPromptTokens: 0, costUsd: null },
			feedbackPrompt: null,
		})}\n\n`,
	);
	return frames.join('');
}

let turnIndex = 0;

async function installFakeApi(ctx) {
	await ctx.route('**/v1/**', async (route) => {
		const req = route.request();
		const url = req.url();
		const json = (data, extra = {}) =>
			route.fulfill({
				status: 200,
				headers: { 'content-type': 'application/json', ...CORS },
				body: JSON.stringify({ success: true, data, ...extra }),
			});

		if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });

		if (url.includes('/v1/agent/chat/stream')) {
			const turn = TURNS[turnIndex] ?? TURNS[0];
			return route.fulfill({
				status: 200,
				headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', ...CORS },
				body: sse(turn.events),
			});
		}
		if (url.includes('/pending-actions')) return json([]);
		if (/\/v1\/agent\/conversations\/\d+\/messages/.test(url)) return json(HISTORY);
		if (url.includes('/v1/agent/conversations'))
			return json(CONVERSATIONS, { meta: { page: 1, limit: 30, total: 1, totalPages: 1 } });
		if (url.includes('/v1/employees/me')) return json(EMPLOYEE);
		if (url.includes('/v1/auth/me')) return json({ permissions: [] });
		return json([], { meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
	});
}

/**
 * Đo tràn ngang thay vì nhìn ảnh đoán — cùng bộ dò với agent-chart-shots.mjs.
 *
 * `agent-table-wrap` nằm trong danh sách trắng: nó ĐƯỢC PHÉP cuộn ngang (5 cột không ép
 * vừa màn hình điện thoại được). Mọi phần tử khác mà nội dung rộng hơn chính nó đều là lỗi.
 */
async function measureOverflow(page) {
	return page.evaluate(() => {
		const ALLOWED = ['agent-table-wrap', 'truncate'];
		const bad = [];
		for (const el of document.querySelectorAll('body *')) {
			if (el.scrollWidth <= el.clientWidth + 8) continue;
			if (ALLOWED.some((c) => el.classList.contains(c))) continue;
			if (el.clientWidth < 8) continue;
			bad.push({
				what: `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(/\s+/)[0]}`,
				inner: el.scrollWidth,
				outer: el.clientWidth,
			});
		}
		return {
			vw: document.documentElement.clientWidth,
			scrollW: document.documentElement.scrollWidth,
			bad: bad.slice(0, 4).map((x) => `${x.what}: nội dung ${x.inner}px trong khung ${x.outer}px`),
		};
	});
}

/**
 * Kéo khung tin nhắn xuống đáy. Chạy trong trình duyệt (truyền vào page.evaluate).
 *
 * KHÔNG dùng `querySelector('.overflow-y-auto')` đầu tiên: sidebar cũng có class đó nên
 * lệnh cuộn rơi vào nhầm khung và ảnh chụp ra vẫn đứng nguyên chỗ cũ (đã dính thật).
 * Neo theo một bong bóng tin nhắn rồi đi ngược lên khung cuộn chứa nó.
 */
function scrollChatToBottom() {
	const anchor = document.querySelector('.animate-fade-in');
	const sc = anchor?.closest('.overflow-y-auto');
	if (sc) sc.scrollTop = sc.scrollHeight;
	return !!sc;
}

let failures = 0;
function check(ok, label) {
	if (!ok) failures++;
	console.log(`  ${ok ? '✓' : '✗'} ${label}`);
}

async function run(browser, vp) {
	console.log(`\n── ${vp.key} ──────────────────────────────`);
	const ctx = await browser.newContext(vp.opts);
	await ctx.addCookies([{ name: 'access_token', value: 'smoke-token', domain: 'localhost', path: '/' }]);
	await installFakeApi(ctx);
	const page = await ctx.newPage();

	await page.goto(`${BASE}/assistant`, { waitUntil: 'domcontentloaded' });
	const box = page.locator('textarea[placeholder="Nhập câu hỏi cho trợ lý…"]');
	await box.waitFor({ state: 'visible', timeout: 90000 });

	const sendBtn = page.locator('button[title="Gửi câu hỏi"]');
	const stopBtn = page.locator('button[title="Dừng trả lời"]');

	for (let i = 0; i < TURNS.length; i++) {
		turnIndex = i;
		const turn = TURNS[i];

		await stopBtn.waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
		// Đếm TRƯỚC rồi so chênh: bảng và biểu đồ của lượt trước vẫn còn trên màn hình,
		// nên "có bảng" là điều kiện đúng ngay lập tức và không chứng minh được gì.
		const before = await page.evaluate(() => ({
			tables: document.querySelectorAll('.agent-table-wrap table').length,
			charts: document.querySelectorAll('figure canvas').length,
		}));
		await box.click();
		await box.fill(turn.ask);
		await page.waitForFunction(
			() => {
				const b = document.querySelector('button[title="Gửi câu hỏi"]');
				return !!b && !b.hasAttribute('disabled');
			},
			undefined,
			{ timeout: 15000 },
		);
		await sendBtn.click();
		await stopBtn.waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
		await page.waitForTimeout(1200);

		// Kéo khung chat xuống đáy TRƯỚC khi chụp — ảnh chụp giữa chừng thì chỉ thấy
		// tiêu đề bảng, không ai soi được bảng có đúng không. Chụp TRƯỚC các phép thử
		// cuộn bên dưới, vì chúng làm lệch scrollLeft/scrollTop của chính bảng.
		await page.evaluate(scrollChatToBottom);
		await page.waitForTimeout(500);
		await page.screenshot({ path: `${OUT}/table-${turn.key}-${vp.key}.png` });
		if (turn.expect.tables > 0) {
			await page
				.locator('.agent-table-wrap')
				.last()
				.screenshot({ path: `${OUT}/table-${turn.key}-${vp.key}-khung.png` })
				.catch(() => {});
		}

		const after = await page.evaluate(() => ({
			tables: document.querySelectorAll('.agent-table-wrap table').length,
			charts: document.querySelectorAll('figure canvas').length,
			rows: [...document.querySelectorAll('.agent-table-wrap')].pop()?.querySelectorAll('tbody tr').length ?? 0,
		}));
		const got = {
			tables: after.tables - before.tables,
			charts: after.charts - before.charts,
			rows: after.rows,
		};

		check(got.tables === turn.expect.tables, `${turn.key}: thêm ${got.tables} bảng (chờ ${turn.expect.tables})`);
		check(got.charts === turn.expect.charts, `${turn.key}: thêm ${got.charts} biểu đồ (chờ ${turn.expect.charts})`);
		if (turn.expect.rows !== undefined) {
			check(got.rows === turn.expect.rows, `${turn.key}: ${got.rows} dòng (chờ ${turn.expect.rows}) — không được cắt`);
			// Cuộn được: khung bọc phải cao hơn phần nhìn thấy, và kéo được xuống đáy.
			const scroll = await page.evaluate(() => {
				const w = [...document.querySelectorAll('.agent-table-wrap')].pop();
				if (!w) return null;
				const before = w.scrollTop;
				w.scrollTop = w.scrollHeight;
				return { canScrollY: w.scrollHeight > w.clientHeight + 4, moved: w.scrollTop > before, lastRow: w.querySelector('tbody tr:last-child')?.textContent?.trim().slice(0, 12) };
			});
			check(!!scroll?.canScrollY && scroll.moved, `${turn.key}: cuộn dọc được tới dòng cuối (${scroll?.lastRow})`);
		}

		const ov = await measureOverflow(page);
		const okOverflow = ov.scrollW <= ov.vw + 1 && ov.bad.length === 0;
		check(okOverflow, `${turn.key}: không tràn ngang (khung ${ov.vw}px, cuộn ${ov.scrollW}px)`);
		ov.bad.forEach((b) => console.log(`        ${b}`));

		// Mobile: bảng 5 cột PHẢI cuộn ngang được (và chỉ ở trong khung bọc).
		if (turn.expect.tables > 0) {
			const h = await page.evaluate(() => {
				const w = [...document.querySelectorAll('.agent-table-wrap')].pop();
				if (!w) return null;
				const before = w.scrollLeft;
				w.scrollLeft = w.scrollWidth;
				return { overflows: w.scrollWidth > w.clientWidth + 2, moved: w.scrollLeft > before };
			});
			if (vp.key === 'mobile') {
				check(!!h?.overflows && h.moved, `${turn.key}: cuộn ngang được trong khung bảng`);
				await page.screenshot({ path: `${OUT}/table-${turn.key}-${vp.key}-keo-ngang.png` });
			} else {
				console.log(`  · ${turn.key}: desktop ${h?.overflows ? 'có' : 'không'} cần cuộn ngang`);
			}
		}
	}

	// ── Mở lại hội thoại cũ: bảng phải còn, đọc từ message đã lưu ───────────────
	if (vp.key === 'mobile') {
		await page.locator('button[title="Danh sách hội thoại"]').click();
		await page.waitForTimeout(400);
	}
	// `visible=true`: danh sách desktop vẫn nằm trong DOM với `hidden md:flex` trên mobile,
	// nên `.first()` sẽ bắt đúng bản ẩn đó và click treo 30 giây.
	await page.locator('text=Ngày đi muộn tháng 9').locator('visible=true').first().click();
	await page.waitForTimeout(1500);
	await page.evaluate(scrollChatToBottom);
	await page.waitForTimeout(400);
	const history = await page.evaluate(() => ({
		tables: document.querySelectorAll('.agent-table-wrap table').length,
		rows: document.querySelectorAll('.agent-table-wrap tbody tr').length,
		title: document.querySelector('.agent-table-wrap')?.closest('figure')?.querySelector('p')?.textContent?.trim(),
	}));
	check(history.tables === 1 && history.rows === 3, `hội thoại cũ: ${history.tables} bảng / ${history.rows} dòng (chờ 1/3) — "${history.title}"`);
	await page.screenshot({ path: `${OUT}/table-05-hoithoai-cu-${vp.key}.png` });

	await ctx.close();
}

(async () => {
	mkdirSync(OUT, { recursive: true });
	const browser = await chromium.launch({ executablePath: CHROME });
	for (const vp of [
		{ key: 'desktop', opts: { viewport: { width: 1280, height: 900 } } },
		{ key: 'mobile', opts: { ...devices['iPhone 13'] } },
	]) {
		await run(browser, vp);
	}
	await browser.close();
	console.log(`\nẢnh lưu ở ${OUT}`);
	console.log(failures ? `\n${failures} kiểm tra ĐỎ` : '\nTất cả kiểm tra XANH');
	process.exit(failures ? 1 : 0);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
