/**
 * Kiểm quyền trên trang Kỳ văn phòng phẩm: người chỉ có `office:supply:report` (trưởng phòng, vai trò
 * MANAGER mặc định) không thấy nút "Mở kỳ mới", gợi ý "Mở kỳ tháng …" và "Mở kỳ đầu tiên"; admin
 * (có `office:supply:manage`) thấy, để đối chiếu. Trạng thái trống giả bằng chặn request. Không ghi gì.
 *
 * Chạy sau seed-p2.cjs và TRƯỚC smoke-p2.mjs (smoke-p2 mở kỳ Đà Nẵng làm mất gợi ý).
 *
 *   node tests/e2e/supply-catalog/perm-p2.mjs <thư mục ảnh>
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const WEB = 'http://127.0.0.1:4999';
const ACC = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json', 'utf8'));
const PASSWORD = /const PASSWORD\s*=\s*['"`]([^'"`]+)['"`]/.exec(
	readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs', 'utf8'),
)[1];
const SHOTS = process.argv[2] ?? '/tmp/supply-perm-p2';
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(id, ok, name, detail = '') {
	results.push({ id, ok: !!ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${id} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function signIn(browser, email) {
	const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
	page.errors = [];
	page.on('pageerror', err => page.errors.push(String(err)));
	await page.goto(`${WEB}/login`);
	await page.locator('#email').first().waitFor({ timeout: 120000 });
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 120000 });
	return page;
}

async function openList(page) {
	await page.goto(`${WEB}/management/office/supply-periods`);
	await page.getByRole('heading', { name: 'Kỳ đăng ký văn phòng phẩm' }).waitFor({ timeout: 60000 });
	await page.locator('[aria-busy="true"]').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
	await page.waitForTimeout(600);
}

async function inspect(page, tag) {
	await openList(page);
	const state = {
		url: new URL(page.url()).pathname,
		cards: await page.locator('article').count(),
		openBtn: await page.getByRole('button', { name: 'Mở kỳ mới' }).count(),
		suggest: await page.locator('[data-tour="period-suggest"]').count(),
		suggestBtn: await page.getByRole('button', { name: /^Mở kỳ tháng/ }).count(),
	};
	await page.screenshot({ path: `${SHOTS}/${tag}-list.png` });
	// Trạng thái trống: chặn danh sách kỳ trả mảng rỗng.
	await page.route('**/v1/office/supply-periods', route =>
		route.request().method() === 'GET'
			? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
			: route.continue(),
	);
	await openList(page);
	state.empty = await page.getByText('Chưa có kỳ nào.').isVisible().catch(() => false);
	state.firstBtn = await page.getByRole('button', { name: 'Mở kỳ đầu tiên' }).count();
	await page.screenshot({ path: `${SHOTS}/${tag}-empty.png` });
	await page.unroute('**/v1/office/supply-periods');
	return state;
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });

let page = await signIn(browser, ACC.people.admin);
const admin = await inspect(page, 'admin');
check(
	'admin',
	admin.openBtn === 1 && admin.suggest === 1 && admin.suggestBtn === 1 && admin.empty && admin.firstBtn === 1,
	'Admin (có supply:manage) thấy nút Mở kỳ mới, gợi ý, Mở kỳ đầu tiên',
	JSON.stringify(admin),
);
check('admin.err', page.errors.length === 0, 'Không lỗi JS', page.errors.join(' | '));
await page.context().close();

page = await signIn(browser, ACC.people.hanh);
const mgr = await inspect(page, 'manager');
check('mgr.access', mgr.url === '/management/office/supply-periods' && mgr.cards > 0, 'Trưởng phòng (chỉ supply:report) vào được trang và thấy kỳ của phòng mình', JSON.stringify(mgr));
check(
	'mgr.hidden',
	mgr.openBtn === 0 && mgr.suggest === 0 && mgr.suggestBtn === 0 && mgr.empty && mgr.firstBtn === 0,
	'Trưởng phòng không thấy Mở kỳ mới, gợi ý mở kỳ, Mở kỳ đầu tiên',
	`Mở kỳ mới ${mgr.openBtn}, gợi ý ${mgr.suggest}, nút gợi ý ${mgr.suggestBtn}, trống ${mgr.empty}, Mở kỳ đầu tiên ${mgr.firstBtn}`,
);
check('mgr.err', page.errors.length === 0, 'Không lỗi JS', page.errors.join(' | '));
await page.context().close();

await browser.close();
const bad = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - bad.length}/${results.length} xanh ===`);
process.exit(bad.length ? 1 : 0);
