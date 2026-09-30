/**
 * Chụp màn hình thanh ĐÁNH GIÁ câu trả lời của trợ lý — desktop, mobile, nền tối.
 *
 * ── Vì sao script này chặn API thay vì gọi backend thật ───────────────────────
 *
 * Khác `agent-chart-shots.mjs` (cần BE 3999 + token thật), ở đây toàn bộ `/v1/**` bị
 * chặn ngay trong browser và trả dữ liệu giả. Ba lý do:
 *
 *  1. Thanh đánh giá chỉ hiện khi server GỬI `feedbackPrompt`, mà server chỉ gửi ở lượt
 *     thứ 2/7/12… và sau khi bảng `agent_feedbacks` tồn tại. Chờ đúng điều kiện đó trên
 *     BE thật thì phải chat nhiều lượt, tốn token, và vẫn không chắc trúng nhịp.
 *  2. Không cần cơ sở dữ liệu, không ghi một dòng nào — chạy được trước khi migration
 *     được apply.
 *  3. Chụp được cả trạng thái khó dựng thật: đã chấm, đang mở ô ghi chú, mở lại hội
 *     thoại cũ đã chấm từ trước.
 *
 * Đánh đổi: script này KHÔNG kiểm được backend. Nó kiểm phần duy nhất mà không test nào
 * ở backend nhìn thấy — bố cục, độ tương phản, tràn ngang trên điện thoại.
 *
 * ── Cách chạy ────────────────────────────────────────────────────────────────
 *
 *   npx nuxt dev --port 4100          # cửa sổ riêng; KHÔNG cần backend
 *   npm run shots:agent-feedback
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

/** Nhãn do SERVER quyết định — bản giả phải khớp `vi-labels.ts` của backend. */
const RATING_LABELS = {
	BAD: 'Tệ',
	AVERAGE: 'Trung bình',
	USEFUL: 'Hữu dụng với tôi',
	GREAT: 'Rất hay',
};

const FEEDBACK_PROMPT = {
	messageId: 89,
	question: 'Câu trả lời này có giúp được bạn không?',
	options: Object.entries(RATING_LABELS).map(([value, label]) => ({ value, label })),
	commentPlaceholder: 'Muốn nói thêm gì không? (không bắt buộc)',
};

const ANSWER =
	'Bạn còn **8 ngày** phép năm và 0 ngày phép tồn từ năm trước.\n\n' +
	'Trong tháng này bạn đã dùng 1,5 ngày (nghỉ 12/09 và nửa ngày 20/09).';

const ok = (data) => JSON.stringify({ success: true, data });
const page1 = (data) =>
	JSON.stringify({ success: true, data, meta: { page: 1, limit: 20, total: data.length, totalPages: 1 } });

/** Một frame SSE. Tên event ở dòng `event:` mới là thứ client switch theo. */
const frame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const STREAM =
	frame('status', { type: 'status', stage: 'routing', conversationId: 12 }) +
	frame('status', {
		type: 'status',
		stage: 'playbook',
		playbookId: 'leave-balance',
		tier: 'RULE',
		conversationId: 12,
	}) +
	frame('status', { type: 'status', stage: 'tool', tool: 'leave_getMyBalance', conversationId: 12 }) +
	ANSWER.match(/[\s\S]{1,28}/g)
		.map((chunk) => frame('delta', { type: 'delta', text: chunk, conversationId: 12 }))
		.join('') +
	frame('done', {
		conversationId: 12,
		messageId: 89,
		answer: ANSWER,
		playbookId: 'leave-balance',
		routerTier: 'RULE',
		toolsCalled: ['leave_getMyBalance'],
		usage: { promptTokens: 1820, completionTokens: 143, cachedPromptTokens: 0, costUsd: 0.00021 },
		feedbackPrompt: FEEDBACK_PROMPT,
	});

/** Hội thoại cũ: câu trả lời số 77 ĐÃ được chấm từ trước → thanh hiện dạng chip tĩnh. */
const HISTORY = [
	{ id: 76, role: 'user', text: 'Tháng trước tôi đi muộn mấy lần?', createdAt: '2026-09-26T02:10:00.000Z' },
	{
		id: 77,
		role: 'assistant',
		text: 'Tháng 8/2026 bạn đi muộn 2 lần (05/08 muộn 12 phút, 19/08 muộn 4 phút).',
		feedback: {
			messageId: 77,
			rating: 'GREAT',
			ratingLabel: RATING_LABELS.GREAT,
			comment: 'Đúng cái tôi cần, khỏi phải mở bảng công',
			createdAt: '2026-09-26T02:11:00.000Z',
			updatedAt: '2026-09-26T02:11:00.000Z',
		},
		createdAt: '2026-09-26T02:10:06.000Z',
	},
];

const OVERVIEW = {
	summary: {
		from: '2026-08-30',
		to: '2026-09-29',
		conversations: 58,
		messages: 214,
		answers: 107,
		requests: 196,
		activeUsers: 23,
		promptTokens: 384210,
		completionTokens: 41230,
		totalTokens: 425440,
		cachedPromptTokens: 0,
		cacheHitRate: 0,
		costUsd: 0.094,
		costPerRequestUsd: 0.00048,
	},
	daily: [
		{ bucket: '2026-09-25', promptTokens: 40120, completionTokens: 4310, cachedPromptTokens: 0, costUsd: 0.011, requests: 22 },
		{ bucket: '2026-09-26', promptTokens: 52300, completionTokens: 5920, cachedPromptTokens: 0, costUsd: 0.014, requests: 28 },
		{ bucket: '2026-09-27', promptTokens: 18900, completionTokens: 2010, cachedPromptTokens: 0, costUsd: 0.005, requests: 9 },
		{ bucket: '2026-09-28', promptTokens: 61040, completionTokens: 6880, cachedPromptTokens: 0, costUsd: 0.017, requests: 31 },
		{ bucket: '2026-09-29', promptTokens: 44380, completionTokens: 5120, cachedPromptTokens: 0, costUsd: 0.012, requests: 24 },
	],
	byModel: [
		{ bucket: 'deepseek/deepseek-v4-flash', promptTokens: 380000, completionTokens: 40000, cachedPromptTokens: 0, costUsd: 0.09, requests: 190 },
	],
	byPurpose: [
		{ bucket: 'CHAT', promptTokens: 370000, completionTokens: 38000, cachedPromptTokens: 0, costUsd: 0.087, requests: 178 },
		{ bucket: 'TITLE', promptTokens: 10210, completionTokens: 3230, cachedPromptTokens: 0, costUsd: 0.007, requests: 18 },
	],
	topics: [
		{ playbookId: 'leave-balance', runs: 128, share: 41.2, successRate: 96.1, fallback: 2, toolError: 0, modelError: 1, byTier: { RULE: 80, EMBEDDING: 30, LLM: 16, FALLBACK: 2 } },
		{ playbookId: 'attendance-my-summary', runs: 96, share: 30.9, successRate: 93.8, fallback: 4, toolError: 1, modelError: 0, byTier: { RULE: 52, EMBEDDING: 31, LLM: 9, FALLBACK: 4 } },
		{ playbookId: 'fallback', runs: 19, share: 6.1, successRate: 0, fallback: 19, toolError: 0, modelError: 0, byTier: { RULE: 0, EMBEDDING: 0, LLM: 0, FALLBACK: 19 } },
	],
	topUsers: [
		{ employeeId: 14, fullName: 'Lê Thị Thùy Linh', requests: 87, totalTokens: 152400, costUsd: 0.042 },
		{ employeeId: 2, fullName: 'Đỗ Hồng Hạnh', requests: 61, totalTokens: 108900, costUsd: 0.028 },
	],
	feedback: {
		total: 42,
		byRating: { BAD: 3, AVERAGE: 9, USEFUL: 21, GREAT: 9 },
		satisfactionRate: 71.4,
		negativeRate: 7.1,
		score: 2.86,
		withComment: 11,
		responseRate: 39.3,
	},
};

const FEEDBACK_ANALYTICS = {
	from: '2026-08-30',
	to: '2026-09-29',
	ratingLabels: RATING_LABELS,
	summary: OVERVIEW.feedback,
	byPlaybook: [
		{ bucket: 'leave-balance', total: 18, byRating: { BAD: 1, AVERAGE: 3, USEFUL: 10, GREAT: 4 }, satisfactionRate: 77.8, score: 3.06 },
		{ bucket: 'attendance-my-summary', total: 14, byRating: { BAD: 0, AVERAGE: 4, USEFUL: 8, GREAT: 2 }, satisfactionRate: 71.4, score: 2.86 },
		{ bucket: 'fallback', total: 7, byRating: { BAD: 2, AVERAGE: 2, USEFUL: 3, GREAT: 0 }, satisfactionRate: 42.9, score: 2.14 },
		{ bucket: 'KHÔNG_RÕ', total: 3, byRating: { BAD: 0, AVERAGE: 0, USEFUL: 0, GREAT: 3 }, satisfactionRate: 100, score: 4 },
	],
	byTier: [
		{ bucket: 'RULE', total: 25, byRating: { BAD: 1, AVERAGE: 5, USEFUL: 14, GREAT: 5 }, satisfactionRate: 76, score: 2.92 },
		{ bucket: 'EMBEDDING', total: 11, byRating: { BAD: 0, AVERAGE: 3, USEFUL: 5, GREAT: 3 }, satisfactionRate: 72.7, score: 3 },
		{ bucket: 'FALLBACK', total: 6, byRating: { BAD: 2, AVERAGE: 1, USEFUL: 2, GREAT: 1 }, satisfactionRate: 50, score: 2.33 },
	],
	comments: [
		{ id: 9, rating: 'BAD', ratingLabel: RATING_LABELS.BAD, comment: 'Số ngày phép không khớp bảng của kế toán', playbookId: 'leave-balance', routerTier: 'RULE', employeeId: 14, fullName: 'Lê Thị Thùy Linh', createdAt: '2026-09-28T10:02:00.000Z' },
		{ id: 8, rating: 'AVERAGE', ratingLabel: RATING_LABELS.AVERAGE, comment: 'Trả lời đúng nhưng dài, mình chỉ cần con số', playbookId: 'attendance-my-summary', routerTier: 'EMBEDDING', employeeId: 2, fullName: 'Đỗ Hồng Hạnh', createdAt: '2026-09-27T08:40:00.000Z' },
		{ id: 7, rating: 'GREAT', ratingLabel: RATING_LABELS.GREAT, comment: 'Nhanh hơn tự mở bảng công nhiều', playbookId: 'attendance-my-summary', routerTier: 'RULE', employeeId: 31, fullName: 'Phạm Quốc Bảo', createdAt: '2026-09-27T03:15:00.000Z' },
	],
};

/** Lời gọi POST feedback mà script bắt được — dùng để xác nhận FE gửi đúng payload. */
const submitted = [];

async function installMocks(page) {
	await page.route('**/v1/**', async (route) => {
		const req = route.request();
		const url = req.url();
		const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body });

		if (url.includes('/v1/employees/me')) {
			return json(
				ok({
					id: 2,
					fullName: 'Đỗ Hồng Hạnh',
					email: 'hanh.dh@example.com',
					employeeCode: 'EMP002',
					role: 'HR',
					avatarUrl: null,
					department: { id: 1, name: 'Nhân sự' },
				}),
			);
		}
		if (url.includes('/v1/auth/me')) return json(ok({ permissions: [] }));

		if (url.includes('/v1/agent/chat/stream')) {
			return route.fulfill({
				status: 200,
				headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' },
				body: STREAM,
			});
		}
		if (/\/v1\/agent\/messages\/\d+\/feedback/.test(url)) {
			const body = req.postDataJSON() ?? {};
			submitted.push(body);
			const now = new Date().toISOString();
			return json(
				ok({
					messageId: Number(url.match(/messages\/(\d+)/)[1]),
					rating: body.rating,
					ratingLabel: RATING_LABELS[body.rating] ?? body.rating,
					comment: body.comment ?? null,
					createdAt: now,
					updatedAt: now,
				}),
			);
		}
		if (/\/v1\/agent\/conversations\/\d+\/messages/.test(url)) return json(ok(HISTORY));
		if (url.includes('/pending-actions')) return json(ok([]));
		if (url.includes('/v1/agent/conversations')) {
			return json(
				page1([
					{ id: 12, title: 'Quỹ phép tháng 9', lastMessageAt: '2026-09-29T09:16:00.000Z', createdAt: '2026-09-29T09:10:00.000Z', messageCount: 4 },
					{ id: 9, title: 'Chuyên cần tháng 8', lastMessageAt: '2026-09-26T02:11:00.000Z', createdAt: '2026-09-26T02:10:00.000Z', messageCount: 6 },
				]),
			);
		}
		if (url.includes('/v1/agent/analytics/feedback')) return json(ok(FEEDBACK_ANALYTICS));
		if (url.includes('/v1/agent/analytics/')) return json(ok(OVERVIEW));

		// Mọi thứ còn lại (danh bạ, metadata, thông báo…): rỗng nhưng hợp lệ, để không
		// có lời gọi nào treo và làm trang không bao giờ render xong.
		return json(page1([]));
	});
}

const shots = [];
let failures = 0;

async function shot(target, name, opts = {}) {
	const file = resolve(OUT, `${name}.png`);
	await target.screenshot({ path: file, ...opts });
	shots.push(name);
	console.log(`  ✓ ${name}.png`);
}

async function newPage(browser, opts, dark = false) {
	const ctx = await browser.newContext(opts);
	const cookies = [
		{ name: 'access_token', value: 'mock.token.for-ui-shots', domain: 'localhost', path: '/' },
	];
	// Nền tối phải đặt qua cookie `color-mode` — plugin color-mode.client chạy lúc hydrate
	// và GHI ĐÈ class trên <html>, nên thêm class bằng tay sau `goto` là vô tác dụng
	// (đã chụp ra ảnh "dark" nhưng vẫn nền trắng).
	if (dark) cookies.push({ name: 'color-mode', value: 'dark', domain: 'localhost', path: '/' });
	await ctx.addCookies(cookies);
	const page = await ctx.newPage();
	await installMocks(page);
	return { ctx, page };
}

/** Gửi một câu hỏi và chờ thanh đánh giá hiện ra. */
async function askAndWait(page) {
	const box = page.locator('textarea[placeholder="Nhập câu hỏi cho trợ lý…"]');
	await box.waitFor({ state: 'visible', timeout: 60000 });
	await box.click();
	await box.fill('Tôi còn mấy ngày phép?');
	await page.locator('button[title="Gửi câu hỏi"]').click();
	const bar = page.locator('[data-testid="agent-feedback-bar"]');
	await bar.waitFor({ state: 'visible', timeout: 30000 });
	return bar;
}

async function chatFlow(browser, { key, opts, dark = false }) {
	const { ctx, page } = await newPage(browser, opts, dark);
	await page.goto(`${BASE}/assistant`, { waitUntil: 'domcontentloaded' });

	const bar = await askAndWait(page);
	if (dark) {
		const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
		if (!isDark) {
			console.error('  ✗ nền tối không bật được — ảnh "dark" sẽ sai, dừng để khỏi báo cáo nhầm');
			failures++;
		}
	}
	await page.waitForTimeout(400); // để animate-fade-in chạy xong, ảnh không bị mờ
	await shot(page, `feedback-01-prompt-${key}`);
	await shot(bar, `feedback-02-prompt-bar-${key}`);

	// Người dùng chọn một mức → thanh đổi sang "Cảm ơn bạn đã đánh giá"
	await bar.getByRole('button', { name: RATING_LABELS.USEFUL }).click();
	await bar.getByText('Cảm ơn bạn đã đánh giá').waitFor({ timeout: 10000 });
	await page.waitForTimeout(250);
	await shot(bar, `feedback-03-rated-bar-${key}`);

	// Mở ô ghi chú rồi gửi kèm góp ý
	await bar.getByRole('button', { name: 'Thêm ghi chú' }).click();
	const area = bar.locator('textarea');
	await area.waitFor({ timeout: 10000 });
	await area.fill('Đúng số nhưng mình cần thêm ngày hết hạn phép');
	await page.waitForTimeout(150);
	await shot(bar, `feedback-04-comment-open-${key}`);
	await bar.getByRole('button', { name: 'Gửi' }).click();
	await bar.getByText('Đúng số nhưng mình cần thêm ngày hết hạn phép').waitFor({ timeout: 10000 });
	await page.waitForTimeout(250);
	await shot(bar, `feedback-05-comment-saved-${key}`);
	await shot(page, `feedback-06-after-rating-${key}`);

	// Mở lại hội thoại cũ: điểm đã chấm phải hiện lại, dạng chip tĩnh
	// Trên mobile danh sách nằm trong drawer, phải bấm nút hamburger mới mở.
	const hamburger = page.locator('button[title="Danh sách hội thoại"]');
	if (await hamburger.isVisible()) await hamburger.click();
	// `:visible` là bắt buộc: sidebar desktop vẫn NẰM TRONG DOM ở khổ mobile (`hidden md:flex`),
	// nên `getByText(...).first()` sẽ bắt đúng phần tử ẩn đó rồi treo 30s chờ nó hiện.
	await page.locator(':text("Chuyên cần tháng 8"):visible').first().click();
	const oldBar = page.locator('[data-testid="agent-feedback-bar"]').first();
	await oldBar.waitFor({ state: 'visible', timeout: 20000 });
	await page.waitForTimeout(400);
	await shot(oldBar, `feedback-07-history-bar-${key}`);
	await shot(page, `feedback-08-history-${key}`);

	// Tràn ngang là lỗi thật đã gặp trên iPhone 13 — đo, đừng chỉ nhìn ảnh.
	const overflow = await page.evaluate(() => {
		const d = document.documentElement;
		return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth };
	});
	if (overflow.scrollWidth > overflow.clientWidth + 1) {
		console.error(
			`  ✗ ${key}: TRÀN NGANG ${overflow.scrollWidth}px > ${overflow.clientWidth}px`,
		);
		failures++;
	} else {
		console.log(`  ✓ ${key}: không tràn ngang (${overflow.scrollWidth}px)`);
	}

	await ctx.close();
}

async function analyticsFlow(browser) {
	const { ctx, page } = await newPage(browser, { viewport: { width: 1280, height: 1100 } });
	await page.goto(`${BASE}/agent-usage`, { waitUntil: 'domcontentloaded' });
	const panel = page.locator('[data-testid="agent-feedback-panel"]');
	await panel.waitFor({ state: 'visible', timeout: 60000 });
	await page.waitForTimeout(600);
	// `fullPage`: bảng đánh giá nằm dưới đáy trang, chụp mỗi viewport thì cắt mất.
	await shot(page, 'feedback-09-analytics-page', { fullPage: true });
	await shot(panel, 'feedback-10-analytics-panel');

	// Chú giải phân bố PHẢI là nhãn tiếng Việt, không được lọt mã enum ra cho người đọc.
	const legend = await panel.innerText();
	for (const code of ['BAD', 'AVERAGE', 'USEFUL', 'GREAT']) {
		if (legend.includes(code)) {
			console.error(`  ✗ bảng đánh giá còn in mã thô "${code}" thay vì nhãn tiếng Việt`);
			failures++;
		}
	}
	await ctx.close();
}

(async () => {
	mkdirSync(OUT, { recursive: true });
	const browser = await chromium.launch({ executablePath: CHROME });
	try {
		console.log('desktop:');
		await chatFlow(browser, { key: 'desktop', opts: { viewport: { width: 1280, height: 900 } } });
		console.log('mobile (iPhone 13):');
		await chatFlow(browser, { key: 'mobile', opts: { ...devices['iPhone 13'] } });
		console.log('nền tối:');
		await chatFlow(browser, { key: 'dark', opts: { viewport: { width: 1280, height: 900 } }, dark: true });
		console.log('trang mức dùng:');
		await analyticsFlow(browser);
	} finally {
		await browser.close();
	}

	console.log(`\n${shots.length} ảnh trong ${OUT}`);
	console.log('payload FE đã gửi:', JSON.stringify(submitted));

	// FE phải gửi lại góp ý cũ khi đổi mức, nếu không backend sẽ xoá nó (comment → null).
	const withComment = submitted.filter((s) => s.comment);
	if (!withComment.length) {
		console.error('✗ Không có lần gửi nào kèm comment — luồng ghi chú không hoạt động.');
		failures++;
	}
	if (failures) {
		console.error(`\n${failures} lỗi.`);
		process.exit(1);
	}
	console.log('\nTất cả đều sạch.');
})().catch((err) => {
	console.error(err);
	process.exit(1);
});
