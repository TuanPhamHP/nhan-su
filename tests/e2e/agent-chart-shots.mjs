/**
 * Chụp màn hình biểu đồ trong khung chat trợ lý — desktop và mobile.
 *
 * Vì sao cần: biểu đồ là thứ DUY NHẤT trong luồng agent mà không test nào ở backend
 * kiểm được. Dữ liệu có thể đúng hoàn toàn mà nhãn vẫn chồng chữ, cột vẫn tràn mép,
 * chữ vẫn bé không đọc nổi trên điện thoại. Chỉ có chụp lại rồi nhìn.
 *
 * ── Cách chạy ────────────────────────────────────────────────────────────────
 *
 * 1) Backend riêng, KHÔNG dùng server đang chạy ở cổng 3000:
 *      cd ../hr-system-be
 *      AGENT_ENABLED=true FCM_ENABLED=false AGENT_DEV_PORT=3999 AGENT_DEV_EMPLOYEE_ID=2 \
 *        npx ts-node -r tsconfig-paths/register scripts/agent-dev-server.ts
 *    Nó in ra một dòng `TOKEN=...` — lấy chuỗi đó.
 *
 * 2) Nuxt trỏ vào backend đó (đừng sửa .env; tạo bản sao rồi đổi BASE_API_URL):
 *      sed 's|^NUXT_PUBLIC_BASE_API_URL=.*|NUXT_PUBLIC_BASE_API_URL=http://localhost:3999|' \
 *        .env > /tmp/env.pw
 *      npx nuxt dev --dotenv /tmp/env.pw --port 4100
 *
 * 3) Chụp:
 *      AGENT_TOKEN='<token ở bước 1>' node tests/e2e/agent-chart-shots.mjs
 *
 * Biến môi trường: `AGENT_TOKEN` (bắt buộc), `BASE_URL` (mặc định http://localhost:4100),
 * `SHOTS_DIR` (mặc định tests/e2e/__shots__), `CHROME_PATH` (mặc định
 * /usr/bin/google-chrome — trình duyệt Playwright tải sẵn hay lệch bản với repo).
 *
 * Script KHÔNG ghi gì vào cơ sở dữ liệu nghiệp vụ: nó chỉ hỏi các câu chỉ đọc.
 */
import { chromium, devices } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.SHOTS_DIR || resolve(HERE, '__shots__');
const BASE = process.env.BASE_URL || 'http://localhost:4100';
const TOKEN = process.env.AGENT_TOKEN;
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

if (!TOKEN) {
	console.error('Thiếu AGENT_TOKEN — xem hướng dẫn ở đầu file.');
	process.exit(2);
}

/** Câu hỏi và loại biểu đồ mong đợi. Thêm tool có biểu đồ mới thì thêm một dòng. */
const ASKS = [
	{ key: 'donut', text: 'cho tôi xem thống kê chuyên cần tháng 8 năm nay' },
	{ key: 'bar', text: 'báo cáo chuyên cần phòng tôi tháng 8' },
];

const VIEWPORTS = [
	{ key: 'desktop', opts: { viewport: { width: 1280, height: 900 } } },
	{ key: 'mobile', opts: { ...devices['iPhone 13'] } },
];

let failures = 0;

async function run(browser, vp) {
	const ctx = await browser.newContext(vp.opts);
	await ctx.addCookies([{ name: 'access_token', value: TOKEN, domain: 'localhost', path: '/' }]);
	const page = await ctx.newPage();

	await page.goto(`${BASE}/assistant`, { waitUntil: 'domcontentloaded' });
	const box = page.locator('textarea[placeholder="Nhập câu hỏi cho trợ lý…"]');
	await box.waitFor({ state: 'visible', timeout: 60000 });

	const stopBtn = page.locator('button[title="Dừng trả lời"]');
	const sendBtn = page.locator('button[title="Gửi câu hỏi"]');

	for (const ask of ASKS) {
		const canvasBefore = await page.locator('figure canvas').count();

		// Trong lúc đang trả lời, nút Gửi bị THAY bằng nút Dừng — nên Enter không gửi
		// được và câu tiếp theo nằm im trong ô nhập. Đã dính thật.
		await stopBtn.waitFor({ state: 'detached', timeout: 120000 }).catch(() => {});
		await box.click();
		await box.fill(ask.text);
		await sendBtn.waitFor({ state: 'visible', timeout: 15000 });
		await page.waitForFunction(
			() => {
				const b = document.querySelector('button[title="Gửi câu hỏi"]');
				return !!b && !b.hasAttribute('disabled');
			},
			undefined,
			{ timeout: 15000 },
		);
		await sendBtn.click();

		// Chờ có THÊM canvas so với trước — không chờ "có canvas", vì canvas của lượt
		// trước vẫn còn trên màn hình nên điều kiện sẽ đúng ngay lập tức.
		let drew = true;
		try {
			await page.waitForFunction(
				(n) => document.querySelectorAll('figure canvas').length > n,
				canvasBefore,
				{ timeout: 90000 },
			);
		} catch {
			drew = false;
		}
		// Chờ trả lời xong hẳn rồi mới chụp, và chừa một nhịp cho animation của chart.js.
		await stopBtn.waitFor({ state: 'detached', timeout: 120000 }).catch(() => {});
		await page.waitForTimeout(2000);

		await page.screenshot({ path: `${OUT}/${ask.key}-${vp.key}-toanmanhinh.png` });

		// ĐO tràn ngang thay vì nhìn ảnh đoán. Bảng markdown từng tràn thẳng ra ngoài mép
		// màn hình trên điện thoại vì bong bóng chat co giãn theo nội dung.
		const overflow = await page.evaluate(() => {
			const vw = document.documentElement.clientWidth;

			/**
			 * Phần tử được PHÉP cuộn ngang. Mọi thứ khác mà nội dung rộng hơn chính nó
			 * đều là lỗi bố cục.
			 *
			 * Vì sao dùng danh sách trắng thay vì đọc `overflow-x`: theo chuẩn CSS, đặt
			 * `overflow-y: auto` làm `overflow-x` TỰ ĐỘNG tính ra `auto`. Khung tin nhắn
			 * của chat có `overflow-y-auto`, nên nếu tin vào computed style thì bộ dò tha
			 * gần như mọi thứ — đã thử và nó im lặng ngay cả khi bảng tràn thật.
			 */
			// `truncate` của Tailwind (overflow hidden + ellipsis) CỐ TÌNH cắt chữ — đó là
			// thiết kế, không phải lỗi bố cục.
			const ALLOWED = ['agent-table-wrap', 'truncate'];

			const bad = [];
			for (const el of document.querySelectorAll('body *')) {
				// scrollWidth > clientWidth = nội dung rộng hơn chỗ chứa. Đây đúng là thứ
				// người dùng gặp: hoặc phải kéo ngang, hoặc bị cắt mất.
				// Ngưỡng 8px: huy hiệu thông báo, viền, bóng đổ lệch vài px là chuyện bình
				// thường. Lỗi bố cục thật đo được ở đây là 200-700px, không nhầm được.
				if (el.scrollWidth <= el.clientWidth + 8) continue;
				if (ALLOWED.some((c) => el.classList.contains(c))) continue;
				// Phần tử tí hon (sr-only, gạch trang trí, con trỏ nhấp nháy) luôn báo lệch
				// vài trăm px mà không ảnh hưởng gì đến bố cục.
				if (el.clientWidth < 8) continue;
				bad.push({
					what: `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(/\s+/)[0]}`,
					inner: el.scrollWidth,
					outer: el.clientWidth,
				});
			}
			bad.sort((x, y) => y.inner - y.outer - (x.inner - x.outer));
			return {
				vw,
				scrollW: document.documentElement.scrollWidth,
				bad: bad.slice(0, 4).map((x) => `${x.what}: nội dung ${x.inner}px trong khung ${x.outer}px`),
			};
		});
		if (overflow.scrollW > overflow.vw + 1 || overflow.bad.length) {
			failures++;
			console.log(`  [${vp.key}] ${ask.key}: ✗ TRÀN NGANG — khung ${overflow.vw}px, cuộn ${overflow.scrollW}px`);
			overflow.bad.forEach((b) => console.log(`        ${b}`));
		} else {
			console.log(`  [${vp.key}] ${ask.key}: ✓ không tràn ngang (khung ${overflow.vw}px)`);
		}
		if (drew) {
			const fig = page.locator('figure').last();
			await fig.screenshot({ path: `${OUT}/${ask.key}-${vp.key}-bieudo.png` });
			const title = await fig.locator('p').first().innerText();
			console.log(`  [${vp.key}] ${ask.key}: ✓ "${title}"`);
		} else {
			failures++;
			const tail = await page.evaluate(() => document.body.innerText.slice(-400));
			console.log(
				`  [${vp.key}] ${ask.key}: ✗ KHÔNG vẽ được. Cuối trang: ${tail.replace(/\s+/g, ' ').slice(-240)}`,
			);
		}
	}
	await ctx.close();
}

(async () => {
	mkdirSync(OUT, { recursive: true });
	const browser = await chromium.launch({ executablePath: CHROME });
	for (const vp of VIEWPORTS) await run(browser, vp);
	await browser.close();
	console.log(`\nẢnh lưu ở ${OUT}`);
	process.exit(failures ? 1 : 0);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
