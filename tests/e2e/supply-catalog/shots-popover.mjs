/**
 * Mở popover ghi chú và "Phòng" ở một dòng sát đáy màn hình, chụp nguyên khung nhìn để xem hộp có
 * mở lên trên không. Chỉ mở rồi đóng, không ghi gì.
 *
 *   node tests/e2e/supply-catalog/shots-popover.mjs
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';

const WEB = 'http://127.0.0.1:4999';
const ACC = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json', 'utf8'));
const PASSWORD = /const PASSWORD\s*=\s*['"`]([^'"`]+)['"`]/.exec(
	readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs', 'utf8'),
)[1];
const SHOTS = '/home/tuanpham/work/hr-system/nhan-su/tests/e2e/__shots__/supply-catalog';
const NAME = 'Sổ lò xo A4';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
for (const width of [1440, 1024]) {
	const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
	await page.goto(`${WEB}/login`);
	await page.locator('#email').first().waitFor({ timeout: 120000 });
	await page.locator('#email').first().fill(ACC.people.hanh);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 120000 });
	await page.goto(`${WEB}/office/supplies`);
	await page.locator('input[data-supply-qty]').first().waitFor({ timeout: 60000 });
	await page.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' });
	// Đưa dòng xuống sát đáy, ngay trên thanh dưới.
	await page.evaluate(name => {
		const input = document.querySelector(`input[data-supply-qty][aria-label="Phần của bạn, ${name}"]`);
		const main = document.querySelector('main');
		if (!input || !main) return;
		main.scrollBy(0, input.getBoundingClientRect().bottom - (window.innerHeight - 90));
	}, NAME);
	await page.waitForTimeout(300);
	const row = page.locator(`input[data-supply-qty][aria-label="Phần của bạn, ${NAME}"]`).locator('xpath=ancestor::div[contains(@class,"py-1.5")][1]');
	for (const [kind, name] of [
		['note', new RegExp(`Ghi chú (của|cho) ${NAME}`)],
		['room', /Phòng:/],
	]) {
		await row.getByRole('button', { name }).dispatchEvent('click');
		await page.waitForTimeout(300);
		const box = await row.locator('[role="dialog"]').boundingBox();
		const footer = await page.locator('[data-tour="supply-footer"]').boundingBox();
		await page.screenshot({ path: `${SHOTS}/w${width}-07-${kind}-popover-bottom.png` });
		console.log(`w${width} ${kind}: hộp ${Math.round(box.y)}–${Math.round(box.y + box.height)}, thanh dưới bắt đầu ${Math.round(footer.y)} → ${box.y + box.height <= footer.y ? 'không bị che' : 'BỊ CHE'}`);
		await page.keyboard.press('Escape');
		await page.waitForTimeout(200);
	}
	await page.context().close();
}
await browser.close();
