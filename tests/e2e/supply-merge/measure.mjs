/** Đo chiều cao các ô của hai hàng trong form "Thêm mặt hàng" (F1 desktop, F2 điện thoại). */
import { WHO, addSection, launch, openSupplies, signIn } from './helper.mjs';

const phone = process.argv.includes('--phone');
const browser = await launch();
const page = await signIn(browser, WHO.nv1, { phone });
await openSupplies(page);
const section = addSection(page);
await section.getByRole('button', { name: 'Mặt hàng không có trong danh mục' }).click();
await page.waitForTimeout(400);

const rows = await section.evaluate(root => {
	const grids = [...root.querySelectorAll(':scope > div.grid, :scope div.grid')];
	return grids.map(grid =>
		[...grid.children].map(child => {
			const control = child.matches('input,button') ? child : child.querySelector('input,button,[tabindex]');
			const box = (control ?? child).getBoundingClientRect();
			return { tag: (control ?? child).tagName, text: ((control ?? child).textContent || (control ?? child).getAttribute('placeholder') || '').trim().slice(0, 24), h: Math.round(box.height * 100) / 100, w: Math.round(box.width) };
		}),
	);
});
console.log(JSON.stringify(rows, null, 1));
console.log('scrollWidth', await page.evaluate(() => document.documentElement.scrollWidth), 'innerWidth', await page.evaluate(() => innerWidth));
await browser.close();
