/**
 * F1–F9 — lưới chọn phân hệ lấy tên, mô tả, nhóm, màu và icon từ server.
 *
 *   node tests/e2e/app-catalog/smoke-catalog.mjs
 *
 * Mọi khẳng định so màn hình với thứ API ĐANG trả, không so với bảng ghi cứng trong bài kiểm:
 * cả lô này sinh ra để FE thôi ghi cứng danh mục, nên bài kiểm cũng không được ghi cứng.
 */
import {
	WHO,
	apiEntitlements,
	clean,
	closeLauncher,
	go,
	groupsOnScreen,
	hexToRgb,
	launch,
	line,
	newPage,
	note,
	openLauncher,
	shot,
	shotLauncher,
	signIn,
	summary,
	tilesOnScreen,
} from './helper.mjs';

const browser = await launch();

/** Ô trên màn hình theo mã, gộp cả ô dùng được lẫn ô khoá. */
function byCode(tiles) {
	return new Map(tiles.map(t => [t.code, t]));
}

// ─── F1: ADMIN công ty mua đủ ─────────────────────────────────────────────────
const full = await apiEntitlements(WHO.full);
line(full.apps?.length === 9 && full.groups?.length === 5, 'F1 API trả 9 ô và 5 nhóm', `${full.apps?.length}/${full.groups?.length}`);

let page = await signIn(browser, WHO.full);
await openLauncher(page, 2500);

const screen = byCode(await tilesOnScreen(page));
line(screen.size === full.apps.length, `F1 lưới hiện đủ ${full.apps.length} ô`, `thấy ${screen.size}: ${[...screen.keys()].join(', ')}`);

for (const tile of full.apps) {
	const got = screen.get(tile.code);
	if (!got) {
		line(false, `F1 lưới có ô ${tile.code}`, 'không thấy');
		continue;
	}
	line(got.text.includes(tile.label), `F1 ${tile.code} hiện đúng tên máy chủ trả`, `"${tile.label}" vs "${got.text}"`);
	line(got.text.includes(tile.description), `F1 ${tile.code} hiện đúng mô tả máy chủ trả`, got.text);
	line(got.icon === tile.icon, `F1 ${tile.code} vẽ đúng icon máy chủ trả`, `${String(got.icon).slice(0, 40)}…`);
	line(got.color === hexToRgb(tile.color), `F1 ${tile.code} tô đúng màu máy chủ trả`, `${got.color} vs ${tile.color}`);
}

const groupNames = await groupsOnScreen(page);
const expectedGroups = full.groups.map(g => g.label).filter(label => full.apps.some(a => full.groups.find(g => g.label === label)?.code === a.group));
line(
	groupNames.join(' | ').includes(expectedGroups.join(' | ')),
	'F1 tên nhóm và thứ tự nhóm theo máy chủ',
	`màn hình: ${groupNames.join(' | ')}`,
);
note(`ảnh lưới bản mới: ${await shotLauncher(page, 'F1-luoi-ban-moi')}`);
await closeLauncher(page);

// ─── F9: tiêu đề tab (cùng phiên, trước khi đổi tài khoản) ────────────────────
await go(page, '/management/employees', 4000);
line((await page.title()).includes('Nhân viên'), 'F9 tiêu đề tab trang Nhân viên', await page.title());
await go(page, '/management/assets/reports', 4000);
line((await page.title()).includes('Báo cáo tài sản'), 'F9 tiêu đề tab trang Báo cáo tài sản', await page.title());

// ─── F4: vào một màn hình trong phân hệ thì sidebar hiện đúng phân hệ ─────────
const sidebar = await page.evaluate(() => {
	const header = document.querySelector('aside button[title="Đổi phân hệ"]');
	const box = header?.querySelector('span');
	return {
		label: (header?.textContent ?? '').replace(/\s+/g, ' ').trim(),
		color: box ? getComputedStyle(box).backgroundColor : null,
		icon: header?.querySelector('svg path')?.getAttribute('d') ?? null,
		items: [...document.querySelectorAll('aside a.nav-item')].map(a => (a.textContent ?? '').trim()).filter(Boolean),
	};
});
const ast = full.apps.find(a => a.code === 'ast');
line(sidebar.label.includes(ast.label), 'F4 sidebar hiện tên phân hệ đang mở', sidebar.label);
line(sidebar.color === hexToRgb(ast.color), 'F4 ô icon phân hệ đúng màu máy chủ', `${sidebar.color} vs ${ast.color}`);
line(sidebar.icon === ast.icon, 'F4 icon phân hệ đúng chuỗi máy chủ trả');
line(sidebar.items.length >= 9, 'F4 mục menu con của phân hệ đầy đủ', `${sidebar.items.length} mục: ${sidebar.items.join(', ')}`);
note(`ảnh sidebar: ${await shot(page, 'F4-sidebar-phan-he', { selector: 'aside' })}`);

// ─── F5: "Gần đây" và ô tìm kiếm ──────────────────────────────────────────────
await openLauncher(page, 2000);
const recent = await page.evaluate(() => {
	const row = [...document.querySelectorAll('p')].find(p => p.textContent?.trim() === 'Gần đây')?.nextElementSibling;
	return [...(row?.querySelectorAll('button') ?? [])].map(b => {
		const box = b.querySelector('span');
		return {
			label: (b.textContent ?? '').trim(),
			color: box ? getComputedStyle(box).backgroundColor : null,
			icon: b.querySelector('svg path')?.getAttribute('d') ?? null,
		};
	});
});
line(recent.length > 0, 'F5 mục "Gần đây" có ô', `${recent.length} ô`);
line(
	recent.every(r => r.label && r.icon && r.color && r.color !== 'rgba(0, 0, 0, 0)'),
	'F5 ô "Gần đây" có cả tên, icon và màu',
	JSON.stringify(recent),
);

for (const [keyword, code] of [['tài sản', 'ast'], ['bảng lương', 'pay'], ['phiếu', 'apv']]) {
	await page.locator('input[placeholder="Tìm phân hệ hoặc màn hình…"]').first().fill(keyword);
	await page.waitForTimeout(700);
	const found = [...byCode(await tilesOnScreen(page)).keys()];
	line(found.includes(code), `F5 gõ "${keyword}" ra ô ${code}`, `thấy ${found.join(', ')}`);
}
await page.locator('input[placeholder="Tìm phân hệ hoặc màn hình…"]').first().fill('');
await page.waitForTimeout(500);
note(`ảnh tìm kiếm: ${await shotLauncher(page, 'F5-tim-kiem')}`);
line(page.errors.length === 0, 'F1–F5, F9 không lỗi JS', page.errors.slice(0, 3).join(' | '));
await page.context().close();

// ─── F2: công ty chưa mua gì ──────────────────────────────────────────────────
const none = await apiEntitlements(WHO.none);
page = await signIn(browser, WHO.none);
await openLauncher(page, 2500);
const noneScreen = byCode(await tilesOnScreen(page));

for (const tile of none.apps.filter(a => a.locked)) {
	const got = noneScreen.get(tile.code);
	line(!!got?.locked, `F2 ô ${tile.code} hiện ở trạng thái khoá như máy chủ báo`, JSON.stringify(got));
	line(got?.text.includes('Chưa đăng ký') ?? false, `F2 ô ${tile.code} mang nhãn "Chưa đăng ký"`, got?.text);
}
line(
	none.apps.filter(a => a.locked).map(a => a.code).join(',') === 'rec,ast',
	'F2 máy chủ báo đúng hai phân hệ bán riêng đang khoá',
	none.apps.filter(a => a.locked).map(a => a.code).join(','),
);
note(`ảnh lưới công ty chưa mua: ${await shotLauncher(page, 'F2-luoi-chua-mua')}`);

await page.locator('[data-locked-app="rec"]').first().click();
await page.locator('[data-testid="module-locked-dialog"]').waitFor({ state: 'visible', timeout: 15000 });
const dialog = clean(await page.locator('[data-testid="module-locked-dialog"]').innerText());
line(dialog.includes(none.apps.find(a => a.code === 'rec').label), 'F2 hộp thoại gọi đúng tên phân hệ', dialog.slice(0, 120));
const hotline = clean(await page.locator('[data-testid="module-locked-hotline"]').innerText());
line(hotline === none.businessHotline, 'F2 hộp thoại ghi đúng hotline máy chủ trả', `${hotline} vs ${none.businessHotline}`);
note(`ảnh hộp thoại: ${await shot(page, 'F2-hop-thoai-chua-dang-ky')}`);
line(page.errors.length === 0, 'F2 không lỗi JS', page.errors.slice(0, 3).join(' | '));
await page.context().close();

// ─── F2b: tạm ngưng và quá hạn ────────────────────────────────────────────────
for (const [tenant, badge] of [['susp', 'Tạm ngưng'], ['lapsed', 'Đã hết hạn']]) {
	const data = await apiEntitlements(WHO[tenant]);
	page = await signIn(browser, WHO[tenant]);
	await openLauncher(page, 2500);
	const tiles = byCode(await tilesOnScreen(page));

	const astTile = data.apps.find(a => a.code === 'ast');
	const got = tiles.get('ast');
	line(!!got?.locked, `F2b ${tenant}: ô Tài sản khoá`, JSON.stringify(got));
	line(got?.text.includes(badge) ?? false, `F2b ${tenant}: nhãn "${badge}"`, got?.text);
	line(astTile.locked === true, `F2b ${tenant}: máy chủ cũng báo khoá`, `lockReason=${astTile.lockReason}`);

	const recTile = data.apps.find(a => a.code === 'rec');
	line(
		tiles.get('rec')?.locked === recTile.locked,
		`F2b ${tenant}: ô Tuyển dụng khớp trạng thái máy chủ`,
		`màn hình khoá=${tiles.get('rec')?.locked} máy chủ khoá=${recTile.locked}`,
	);
	note(`ảnh ${tenant}: ${await shotLauncher(page, `F2b-${tenant}`)}`);
	line(page.errors.length === 0, `F2b ${tenant}: không lỗi JS`, page.errors.slice(0, 3).join(' | '));
	await page.context().close();
}

// ─── F3: nhân viên thường ─────────────────────────────────────────────────────
page = await signIn(browser, WHO.employee);
await openLauncher(page, 2500);
const empTiles = [...byCode(await tilesOnScreen(page)).keys()];
line(empTiles.length > 0, 'F3 nhân viên vẫn có lưới phân hệ', empTiles.join(', '));
line(!empTiles.includes('sys'), 'F3 nhân viên không thấy Quản trị hệ thống', empTiles.join(', '));
line(!empTiles.includes('pay'), 'F3 nhân viên không thấy Tính lương', empTiles.join(', '));
note(`ảnh lưới nhân viên: ${await shotLauncher(page, 'F3-luoi-nhan-vien')}`);
line(page.errors.length === 0, 'F3 không lỗi JS', page.errors.slice(0, 3).join(' | '));
await page.context().close();

// ─── F6: chặn hẳn endpoint danh mục ───────────────────────────────────────────
let blocked = true;
page = await newPage(browser, {
	route: async p => {
		await p.route('**/v1/me/entitlements*', route => (blocked ? route.abort() : route.continue()));
	},
});
page = await signIn(browser, WHO.full, { page });
await go(page, '/management/employees', 4000);
line(clean(await page.locator('body').innerText()).length > 50, 'F6 trang vẫn dựng được, không trắng trang');

const navItems = await page.locator('aside a.nav-item').count();
line(navItems >= 4, 'F6 sidebar vẫn còn mục để bấm khi danh mục hỏng', `${navItems} mục`);
await page.locator('aside a.nav-item').nth(2).click();
await page.waitForTimeout(3000);
line(page.url().startsWith('http://localhost') && page.url() !== `${page.url()}#`, 'F6 bấm mục sidebar vẫn điều hướng', page.url());

await openLauncher(page, 2000);
line(
	(await page.locator('[data-testid="catalog-error"]').count()) === 1,
	'F6 lưới báo chưa tải được danh mục',
	clean(await page.locator('[role="dialog"]').innerText()).slice(0, 160),
);
line((await page.locator('[data-testid="catalog-retry"]').count()) === 1, 'F6 có nút Thử lại');
note(`ảnh lưới lỗi: ${await shotLauncher(page, 'F6-luoi-chua-tai-duoc')}`);

blocked = false;
await page.locator('[data-testid="catalog-retry"]').click();
await page.waitForTimeout(4000);
const afterRetry = [...byCode(await tilesOnScreen(page)).keys()];
line(afterRetry.length === full.apps.length, 'F6 bấm Thử lại thì lưới có đủ ô', afterRetry.join(', '));
line((await page.locator('[data-testid="catalog-error"]').count()) === 0, 'F6 câu báo lỗi biến mất sau khi tải được');
note(`ảnh sau khi thử lại: ${await shotLauncher(page, 'F6-sau-khi-thu-lai')}`);
line(page.errors.length === 0, 'F6 không lỗi JS', page.errors.slice(0, 3).join(' | '));
await page.context().close();

// ─── F7: máy chủ đổi tên và màu thì lưới đổi theo, không sửa code FE ──────────
const FAKE_LABEL = 'Hồ sơ nhân sự (bản thử)';
const FAKE_COLOR = '#ff00aa';
page = await newPage(browser, {
	route: async p => {
		await p.route('**/v1/me/entitlements*', async route => {
			const res = await route.fetch();
			const body = await res.json();
			const chr = body.data.apps.find(a => a.code === 'chr');
			chr.label = FAKE_LABEL;
			chr.color = FAKE_COLOR;
			// F8 đi cùng một lần chặn: thêm một ô mã lạ mà web chưa có màn hình.
			body.data.apps.push({ ...chr, code: 'xyz', label: 'Phân hệ web chưa có', color: '#123456' });
			await route.fulfill({ response: res, json: body });
		});
	},
});
page = await signIn(browser, WHO.full, { page });
await openLauncher(page, 2500);
const faked = byCode(await tilesOnScreen(page));
line(faked.get('chr')?.text.includes(FAKE_LABEL) ?? false, 'F7 lưới hiện tên máy chủ vừa đổi', faked.get('chr')?.text);
line(faked.get('chr')?.color === hexToRgb(FAKE_COLOR), 'F7 lưới tô màu máy chủ vừa đổi', faked.get('chr')?.color);
line(!faked.has('xyz'), 'F8 ô mã lạ bị bỏ qua, không hiện trong lưới', [...faked.keys()].join(', '));
line(faked.size === full.apps.length, 'F8 các ô còn lại vẫn đủ', `${faked.size} ô`);
line(page.errors.length === 0, 'F7, F8 không lỗi JS', page.errors.slice(0, 3).join(' | '));
note(`ảnh lưới đổi tên màu: ${await shotLauncher(page, 'F7-doi-ten-mau')}`);
await page.context().close();

await browser.close();
process.exit(summary() === 0 ? 0 : 1);
