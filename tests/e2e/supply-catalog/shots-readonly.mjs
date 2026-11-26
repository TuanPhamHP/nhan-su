/**
 * Chụp lại màn phiếu chỉ xem ở 1440 và 1024 trên sandbox (chỉ đọc, không ghi gì).
 *
 *   node tests/e2e/supply-catalog/shots-readonly.mjs
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';

const WEB = 'http://127.0.0.1:4999';
const ACC = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json', 'utf8'));
const PASSWORD = /const PASSWORD\s*=\s*['"`]([^'"`]+)['"`]/.exec(
	readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs', 'utf8'),
)[1];
const SHOTS = '/home/tuanpham/work/hr-system/nhan-su/tests/e2e/__shots__/supply-catalog';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
for (const width of [1440, 1024]) {
	const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
	await page.goto(`${WEB}/login`);
	await page.locator('#email').first().waitFor({ timeout: 120000 });
	await page.locator('#email').first().fill(ACC.people.hanh);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 120000 });
	await page.goto(`${WEB}/office/supplies?request_id=${ACC.requests.oct}`);
	await page.getByText('Phiếu đã khoá, chỉ xem').waitFor({ timeout: 60000 });
	await page.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' });
	await page.waitForTimeout(800);
	await page.screenshot({ path: `${SHOTS}/w${width}-06j-readonly.png` });
	const rows = await page.locator('input[data-supply-qty]').evaluateAll(els =>
		els.map(e => {
			const row = e.closest('div.py-1\\.5');
			const name = row?.querySelector('p');
			return Math.abs((name?.getBoundingClientRect().top ?? 0) - e.getBoundingClientRect().top) < 12;
		}),
	);
	console.log(`w${width}: ${rows.filter(Boolean).length}/${rows.length} dòng nằm trên một hàng`);
	await page.context().close();
}
await browser.close();
