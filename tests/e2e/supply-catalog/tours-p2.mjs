/**
 * Chạy hướng dẫn "Mở kỳ văn phòng phẩm" bằng tài khoản HCNS (admin sandbox) trên trang Kỳ văn phòng
 * phẩm; báo bước nào mất mốc. Không mở kỳ nào: bước cuối bấm Xong và hộp tự đóng.
 *
 *   node tests/e2e/supply-catalog/tours-p2.mjs <thư mục ảnh>
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const WEB = 'http://127.0.0.1:4999';
const ACC = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json', 'utf8'));
const PASSWORD = /const PASSWORD\s*=\s*['"`]([^'"`]+)['"`]/.exec(
	readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs', 'utf8'),
)[1];
const SHOTS = process.argv[2] ?? '/tmp/supply-tours-p2';
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${WEB}/login`);
await page.locator('#email').first().waitFor({ timeout: 120000 });
await page.locator('#email').first().fill(ACC.people.admin);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 120000 });
await page.goto(`${WEB}/management/office/supply-periods`);
await page.locator('article').first().waitFor({ timeout: 60000 });

await page.getByRole('button', { name: 'Hướng dẫn theo tính năng' }).click();
const list = page.getByRole('dialog', { name: 'Danh sách hướng dẫn' });
for (const btn of await list.locator('button[aria-expanded="false"]:not([disabled])').all()) await btn.click();
await list.getByRole('button', { name: /Mở kỳ văn phòng phẩm/ }).click();

const seen = [];
for (let i = 0; i < 12; i++) {
	try {
		await page.locator('#tour-box-title').waitFor({ timeout: 8000 });
	} catch {
		break;
	}
	const title = (await page.locator('#tour-box-title').innerText()).trim();
	await page.waitForTimeout(600);
	const lit = (await page.locator('[data-tour-overlay] .ring-2').count()) > 0;
	seen.push(`${title}${lit ? '' : ' (không ô sáng)'}`);
	await page.screenshot({ path: `${SHOTS}/tour-${String(seen.length).padStart(2, '0')}.png` });
	const primary = page.locator('[aria-labelledby="tour-box-title"] button').last();
	const label = (await primary.innerText()).trim();
	await primary.click();
	if (label === 'Xong') break;
	await page
		.waitForFunction(prev => document.querySelector('#tour-box-title')?.textContent?.trim() !== prev, title, { timeout: 10000 })
		.catch(() => {});
}
await page.waitForTimeout(500);
const modalLeft = await page.getByRole('dialog', { name: 'Mở kỳ đăng ký văn phòng phẩm' }).count();
console.log(seen.join('\n'));
console.log(`hộp Mở kỳ còn mở: ${modalLeft}`);
await browser.close();
