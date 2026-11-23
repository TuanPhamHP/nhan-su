/**
 * Bấm thử hướng dẫn từng bước, 15 scenario của bàn giao (bản rút gọn 22/11: tối đa 5 bước mỗi
 * tour). Chạy: `node smoke.mjs [S1 S2 ...]`, không truyền gì thì chạy hết. Ghi toàn bộ chữ các
 * bước ra `steps-text.json` và danh sách ảnh ra `shots.json`.
 */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
	ASSETS,
	BOX,
	SHOTS,
	WEB,
	WHO,
	apiToken,
	assetTotal,
	boxButton,
	clickCenter,
	holeFits,
	holeInfo,
	launch,
	line,
	next,
	overlaps,
	readStep,
	shot,
	signIn,
	summary,
	tourOpen,
	waitShown,
} from './helper.mjs';

const only = new Set(process.argv.slice(2));
const want = id => !only.size || only.has(id);
const texts = {};
const shots = {};

/** Tên file ảnh không dấu, để đường dẫn dán vào đâu cũng mở được. */
const slug = s =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/đ/gi, 'd')
		.replace(/[^a-z0-9]+/gi, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase();

// Không tìm theo tiêu đề: hộp hướng dẫn có thể có tiêu đề trùng chữ với khung trên trang.
const formOpen = page => page.locator('[data-tour="asset-form-main"]').count().then(n => n > 0);
const menuOpen = page => page.locator('[data-tour="asset-actions-menu"]').count().then(n => n > 0);
const TOUR_BUTTON = '[data-tour-button]';

/** Phần tử thật người dùng bấm ở các bước `click`. */
const CLICK_TARGET = {
	'Thêm tài sản mới': '[data-tour="asset-add"]',
	'Làm gì với tài sản': '[data-tour="asset-actions"] button',
};

/** Phần tử được trỏ ở từng bước, để đo ô sáng. */
const STEP_TARGET = {
	'Xem nhanh': '[data-tour="asset-overview"]',
	'Tìm tài sản': '[data-tour="asset-filters"]',
	'Xem chi tiết': '[data-tour="asset-list"]',
	'Thêm tài sản mới': '[data-tour="asset-add"]',
	'Điền thông tin': '[data-tour="asset-form-main"]',
	'Tài sản này': '[data-tour="asset-detail-head"]',
	'Làm gì với tài sản': '[data-tour="asset-actions"]',
	'Chọn việc cần làm': '[data-tour="asset-actions-menu"]',
	'Lịch sử và giấy tờ': '[data-tour="asset-tabs"]',
	'Nhận tài sản': '[data-tour="my-confirm"]',
	'Hỏng hay mất': '[data-tour="my-report"]',
};

/**
 * Đi hết tour: bấm thật vào phần tử ở bước `click`, bấm Tiếp hoặc Xong ở bước còn lại. Mỗi bước
 * có thể chụp ảnh (`prefix`) và kiểm ô sáng ôm đúng phần tử. Trả danh sách bước đã thấy.
 */
async function walk(page, { prefix, onStep } = {}) {
	const seen = [];
	for (let guard = 0; guard < 20; guard++) {
		if (!(await tourOpen(page))) break;
		await waitShown(page);
		const s = await readStep(page);
		const sel = STEP_TARGET[s.title];
		s.fits = sel ? holeFits(await holeInfo(page, sel)) : null;
		if (prefix) s.shot = await shot(page, `${prefix}-${seen.length + 1}-${slug(s.title)}`);
		seen.push(s);
		if (onStep) await onStep(s, seen.length);
		if (s.action) {
			await clickCenter(page, CLICK_TARGET[s.title]);
			await page.waitForFunction(
				([box, title]) => document.querySelector(box)?.querySelector('#tour-box-title')?.textContent?.trim() !== title,
				[BOX, s.title],
				{ timeout: 15000 },
			);
			continue;
		}
		if (s.number === s.total) {
			await (await boxButton(page, 'Xong')).click();
			await page.waitForTimeout(500);
			break;
		}
		await next(page);
	}
	return seen;
}

const titlesOf = seen => seen.map(s => s.title);
const numberedOk = seen => seen.every((s, i) => s.number === i + 1 && s.total === seen.length);
const fitsOk = seen => seen.every(s => s.fits !== false);
const record = (key, seen) => {
	texts[key] = seen.map(s => ({ step: `${s.number}/${s.total}`, title: s.title, body: s.body, action: s.action || undefined }));
	shots[key] = seen.map(s => s.shot).filter(Boolean);
};

async function openAssets(page, path = '/management/assets') {
	await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded' });
}

async function goToStep(page, title) {
	let s = await readStep(page);
	for (let i = 0; s.title !== title && i < 10; i++) {
		if (s.action) {
			await clickCenter(page, CLICK_TARGET[s.title]);
			await waitShown(page);
		} else {
			await next(page);
		}
		s = await readStep(page);
	}
	return s;
}

const browser = await launch();
const adminToken = await apiToken(WHO.admin);

try {
	// ─── S1 + S2: ADMIN lần đầu, đi hết; F5 không hiện lại; nút Hướng dẫn chạy lại ───────────
	if (want('S1') || want('S2')) {
		const page = await signIn(browser, WHO.admin);
		const before = await assetTotal(adminToken);
		await openAssets(page);
		let auto = false;
		try {
			await waitShown(page, 20000);
			auto = true;
		} catch {
			auto = false;
		}
		let formOpenAtLast = false;
		const seen = auto
			? await walk(page, {
					prefix: 'list-admin',
					onStep: async s => {
						if (s.title === 'Điền thông tin') formOpenAtLast = await formOpen(page);
					},
				})
			: [];
		record('Quản lý tài sản (ADMIN, máy tính)', seen);
		await page.waitForTimeout(800);
		const after = await assetTotal(adminToken);
		line(
			'S1',
			auto && seen.length === 5 && numberedOk(seen) && fitsOk(seen) && formOpenAtLast && !(await tourOpen(page)) && !(await formOpen(page)) && after === before && !page.writes.length,
			'ADMIN lần đầu: tour tự hiện, 5 bước, bấm Xong thì khung đóng, không có tài sản mới',
			`tự hiện=${auto}, ${seen.length} bước: ${titlesOf(seen).join(' | ')}; ô sáng đúng=${fitsOk(seen)}; khung mở ở bước 5=${formOpenAtLast}, sau Xong còn mở=${await formOpen(page)}; tài sản ${before}→${after}; request ghi=${page.writes.length}`,
		);

		if (want('S2')) {
			await page.reload({ waitUntil: 'domcontentloaded' });
			await page.locator(TOUR_BUTTON).waitFor({ timeout: 30000 });
			await page.waitForTimeout(3500);
			const autoAgain = await tourOpen(page);
			await page.locator(TOUR_BUTTON).click();
			await waitShown(page);
			const s = await readStep(page);
			line('S2', !autoAgain && s.number === 1 && s.total === 5 && s.title === 'Xem nhanh', 'F5 không tự hiện lại; nút Hướng dẫn chạy lại từ đầu', `tự hiện lại=${autoAgain}, bước đầu "${s.title}" ${s.number}/${s.total}`);
			await (await boxButton(page, 'Bỏ qua')).click();
		}
		line('S1.err', !page.errors.length, 'không lỗi console', page.errors.slice(0, 3).join(' | '));
		await page.context().close();
	}

	// ─── S3, S4, S5: bỏ qua, Esc khi khung đang mở, bấm ra ngoài, quay lại ─────────────────
	if (want('S3') || want('S4') || want('S5')) {
		const page = await signIn(browser, WHO.admin);
		await openAssets(page);
		await waitShown(page, 20000);

		// S4, bước chỉ xem: bấm ra ngoài, rồi bấm thẳng vào một ô trong ô sáng (ô đó là một link).
		const url0 = page.url();
		await page.mouse.click(30, 450);
		await page.mouse.click(700, 820);
		await clickCenter(page, '[data-tour="asset-overview"] a[href*="pendingConfirmation"]');
		await page.waitForTimeout(1200);
		const afterInfo = await readStep(page);
		const infoOk = afterInfo.title === 'Xem nhanh' && page.url() === url0;
		shots.S4 = [await shot(page, 's4-bam-vao-o-sang-buoc-chi-xem')];

		// S3a: Bỏ qua ở bước giữa.
		await next(page);
		const mid = await readStep(page);
		await (await boxButton(page, 'Bỏ qua')).click();
		await page.waitForTimeout(400);
		const goneMid = !(await tourOpen(page));

		// S4, bước bấm thật: bấm ra ngoài thì khung không mở, bước không đổi.
		await page.locator(TOUR_BUTTON).click();
		await waitShown(page);
		await goToStep(page, 'Thêm tài sản mới');
		await page.mouse.click(30, 450);
		await page.mouse.click(700, 820);
		await page.waitForTimeout(800);
		const afterClickOutside = await readStep(page);
		const clickOk = afterClickOutside.title === 'Thêm tài sản mới' && !(await formOpen(page)) && page.url() === url0;
		line('S4', infoOk && clickOk, 'Bấm ngoài ô sáng không có gì xảy ra; bấm vào link trong ô sáng ở bước chỉ xem cũng không đi đâu', `chỉ xem: vẫn ở "${afterInfo.title}", URL đổi=${page.url() !== url0}; bấm thật: vẫn ở "${afterClickOutside.title}", khung mở=${await formOpen(page)}`);

		// S5: Quay lại ở bước trong khung.
		await clickCenter(page, '[data-tour="asset-add"]');
		await waitShown(page);
		const inForm = await readStep(page);
		const openBefore = await formOpen(page);
		await (await boxButton(page, 'Quay lại')).click();
		await waitShown(page);
		const back = await readStep(page);
		await page.waitForTimeout(300);
		const openAfter = await formOpen(page);
		line('S5', inForm.title === 'Điền thông tin' && openBefore && back.title === 'Thêm tài sản mới' && !openAfter, 'Quay lại ở bước trong khung: về bước Thêm tài sản mới, khung đóng', `từ "${inForm.title}" (khung mở=${openBefore}) về "${back.title}" (khung mở=${openAfter})`);
		shots.S5 = [await shot(page, 's5-quay-lai-ve-them')];

		// S3b: Esc khi khung đang mở.
		await clickCenter(page, '[data-tour="asset-add"]');
		await waitShown(page);
		const openBeforeEsc = await formOpen(page);
		await page.keyboard.press('Escape');
		await page.waitForTimeout(500);
		const goneEsc = !(await tourOpen(page)) && !(await formOpen(page));
		line('S3', goneMid && openBeforeEsc && goneEsc && !page.writes.length, 'Bỏ qua ở bước giữa và Esc khi khung đang mở: tour tắt, khung đóng', `bỏ qua ở bước ${mid.number} "${mid.title}" → tắt=${goneMid}; Esc khi khung mở=${openBeforeEsc} → tắt và đóng=${goneEsc}; request ghi=${page.writes.length}`);
		line('S3.err', !page.errors.length, 'không lỗi console', page.errors.slice(0, 3).join(' | '));
		await page.context().close();
	}

	// ─── S6: trưởng phòng không có asset:manage ─────────────────────────────────────────
	if (want('S6')) {
		const page = await signIn(browser, WHO.manager);
		await openAssets(page);
		await waitShown(page, 20000);
		const seen = await walk(page, { prefix: 'list-manager' });
		record('Quản lý tài sản (trưởng phòng)', seen);
		line('S6', seen.length === 3 && numberedOk(seen) && !titlesOf(seen).includes('Thêm tài sản mới') && !page.writes.length, 'Trưởng phòng: 3 bước, không có Thêm tài sản; số bước đúng', `${seen.length} bước: ${titlesOf(seen).join(' | ')}`);
		await page.context().close();
	}

	// ─── S7: module chỉ xem ─────────────────────────────────────────────────────────────
	if (want('S7')) {
		execFileSync('node', ['/home/tuanpham/work/hr-system/.sandbox-tour/set-module-tour.cjs', 'READ_ONLY'], { stdio: 'inherit' });
		try {
			const page = await signIn(browser, WHO.admin);
			await openAssets(page);
			await waitShown(page, 20000);
			const seen = await walk(page);
			record('Quản lý tài sản (ADMIN, module chỉ xem)', seen);
			line('S7', seen.length === 3 && numberedOk(seen) && !titlesOf(seen).includes('Thêm tài sản mới') && !page.writes.length, 'Module chỉ xem: 3 bước, không có Thêm tài sản', `${seen.length} bước: ${titlesOf(seen).join(' | ')}`);
			await page.context().close();
		} finally {
			execFileSync('node', ['/home/tuanpham/work/hr-system/.sandbox-tour/set-module-tour.cjs', 'ENABLED'], { stdio: 'inherit' });
		}
	}

	// ─── S8: danh sách rỗng, đang tải, phần tử không xuất hiện ──────────────────────────
	if (want('S8')) {
		const page = await signIn(browser, WHO.admin);
		await openAssets(page);
		await waitShown(page, 20000);
		await (await boxButton(page, 'Bỏ qua')).click();

		// (a) Rỗng: tìm một chuỗi không khớp rồi mở lại tour.
		await page.locator('[data-tour="asset-filters"] input').first().fill('khong-co-tai-san-nao-ten-nay');
		await page.getByText(/Không tìm thấy tài sản nào khớp/).waitFor({ timeout: 10000 });
		await page.locator(TOUR_BUTTON).click();
		const seenEmpty = await walk(page);

		// (b) Đang tải: danh sách trả chậm 9 giây, bấm Hướng dẫn ngay khi trang mở.
		const isList = url => url.pathname === '/v1/assets';
		await page.route(isList, async route => {
			await new Promise(r => setTimeout(r, 9000));
			await route.continue().catch(() => {});
		});
		await page.reload({ waitUntil: 'domcontentloaded' });
		await page.locator(TOUR_BUTTON).waitFor({ timeout: 30000 });
		await page.locator(TOUR_BUTTON).click();
		const t0 = Date.now();
		const seenLoading = await walk(page);
		const loadingMs = Date.now() - t0;
		await page.unroute(isList);

		// (c) Phần tử của bước 2 biến mất: tour chờ tối đa 4 giây rồi bỏ bước đó, đánh lại số.
		await page.reload({ waitUntil: 'domcontentloaded' });
		await page.locator('[data-tour="asset-list"]:visible').first().waitFor({ timeout: 30000 });
		await page.locator(TOUR_BUTTON).click();
		await waitShown(page);
		await page.evaluate(() => document.querySelector('[data-tour="asset-filters"]')?.removeAttribute('data-tour'));
		const t1 = Date.now();
		await next(page);
		const waited = Date.now() - t1;
		const afterWait = await readStep(page);
		shots.S8 = [await shot(page, 's8-bo-buoc-khong-co-phan-tu')];
		await (await boxButton(page, 'Bỏ qua')).click();

		const ok =
			seenEmpty.length === 4 &&
			!titlesOf(seenEmpty).includes('Xem chi tiết') &&
			numberedOk(seenEmpty) &&
			seenLoading.length === 4 &&
			numberedOk(seenLoading) &&
			afterWait.title === 'Xem chi tiết' &&
			afterWait.number === 2 &&
			afterWait.total === 4 &&
			waited < 7000;
		line('S8', ok, 'Danh sách rỗng hoặc đang tải thì bỏ bước danh sách; phần tử không xuất hiện thì chờ rồi bỏ, không treo', `rỗng: ${seenEmpty.length} bước (${titlesOf(seenEmpty).join(' | ')}); đang tải: ${seenLoading.length} bước trong ${Math.round(loadingMs / 1000)} giây; mất phần tử: chờ ${waited} ms rồi sang "${afterWait.title}" ${afterWait.number}/${afterWait.total}`);
		await page.context().close();
	}

	// ─── S9: trang chi tiết, thiết bị và dịch vụ ───────────────────────────────────────
	if (want('S9')) {
		const page = await signIn(browser, WHO.admin);
		const result = {};
		for (const [label, id] of [
			['thiết bị', ASSETS.laptopPendingId],
			['dịch vụ', ASSETS.serviceId],
		]) {
			await page.goto(`${WEB}/management/assets/${id}`, { waitUntil: 'domcontentloaded' });
			await waitShown(page, 20000);
			let menuAtStep3 = false;
			let menuInert = false;
			const seen = await walk(page, {
				prefix: `detail-${id === ASSETS.serviceId ? 'dich-vu' : 'thiet-bi'}`,
				onStep: async s => {
					if (s.title === 'Chọn việc cần làm') {
						menuAtStep3 = await menuOpen(page);
						menuInert = await page.evaluate(() => !!document.querySelector('[data-tour="asset-actions-menu"]')?.inert);
					}
				},
			});
			result[label] = { seen, menuAtStep3, menuInert, menuClosed: !(await menuOpen(page)) };
			record(`Chi tiết tài sản (${label}, ADMIN)`, seen);
			// Lần đầu ở thiết bị đã đánh dấu đã xem; xoá để trang dịch vụ cũng tự hiện.
			await page.evaluate(() => localStorage.clear());
		}
		await page.context().close();

		// Người chỉ xem (trưởng phòng) mở thiết bị của phòng mình: 2 bước, không có Tác vụ.
		const viewer = await signIn(browser, WHO.manager);
		await viewer.goto(`${WEB}/management/assets/${ASSETS.laptopPendingId}`, { waitUntil: 'domcontentloaded' });
		await waitShown(viewer, 20000);
		const seenViewer = await walk(viewer, { prefix: 'detail-truong-phong' });
		record('Chi tiết tài sản (thiết bị, trưởng phòng)', seenViewer);
		await viewer.context().close();

		const dev = result['thiết bị'];
		const svc = result['dịch vụ'];
		const ok =
			dev.seen.length === 4 &&
			svc.seen.length === 4 &&
			numberedOk(dev.seen) &&
			numberedOk(svc.seen) &&
			fitsOk(dev.seen) &&
			fitsOk(svc.seen) &&
			dev.menuAtStep3 &&
			dev.menuInert &&
			svc.menuAtStep3 &&
			dev.menuClosed &&
			svc.menuClosed &&
			svc.seen[3].body.includes('mục Ghế') &&
			dev.seen[3].body.includes('mục Người dùng') &&
			seenViewer.length === 2 &&
			!seenViewer[1].body.includes('thu hồi') &&
			!page.writes.length;
		line(
			'S9',
			ok,
			'Chi tiết thiết bị và dịch vụ: 4 bước, menu Tác vụ mở rồi đóng, không bấm được mục nào; người chỉ xem 2 bước',
			`thiết bị: ${titlesOf(dev.seen).join(' | ')}, menu mở=${dev.menuAtStep3}, khoá bấm=${dev.menuInert}, đóng sau=${dev.menuClosed}; dịch vụ: ${titlesOf(svc.seen).join(' | ')}, menu mở=${svc.menuAtStep3}, đóng sau=${svc.menuClosed}; trưởng phòng: ${titlesOf(seenViewer).join(' | ')}`,
		);
	}

	// ─── S10: Tài sản của tôi ───────────────────────────────────────────────────────────
	if (want('S10')) {
		const res = {};
		for (const [who, prefix] of [
			['employeePending', 'my-nv1'],
			['employeeEmpty', 'my-nv2'],
		]) {
			const page = await signIn(browser, WHO[who]);
			await page.goto(`${WEB}/assets/my`, { waitUntil: 'domcontentloaded' });
			await waitShown(page, 20000);
			const seen = await walk(page, { prefix });
			res[who] = { seen, writes: page.writes.length };
			record(`Tài sản của tôi (${who === 'employeePending' ? 'nv1, có tài sản chờ xác nhận' : 'nv2, chưa giữ gì'})`, seen);
			await page.context().close();
		}
		const p = res.employeePending;
		const e = res.employeeEmpty;
		line(
			'S10',
			p.seen.length === 3 && titlesOf(p.seen).join('|') === 'Tài sản của bạn|Nhận tài sản|Hỏng hay mất' && fitsOk(p.seen) && e.seen.length === 1 && e.seen[0].body.startsWith('Hiện bạn chưa giữ tài sản nào') && !p.writes && !e.writes,
			'Tài sản của tôi: nv1 3 bước, nv2 1 bước, không bấm nút ghi nào',
			`nv1: ${titlesOf(p.seen).join(' | ')}; nv2: ${titlesOf(e.seen).join(' | ')}; request ghi ${p.writes}/${e.writes}`,
		);
	}

	// ─── S11: điện thoại 390×844 ───────────────────────────────────────────────────────
	if (want('S11')) {
		const page = await signIn(browser, WHO.admin, { phone: true });
		await openAssets(page);
		await waitShown(page, 30000);
		const checks = [];
		const seen = await walk(page, {
			prefix: 'list-phone',
			onStep: async s => {
				const sel = STEP_TARGET[s.title];
				const geo = await page.evaluate(() => ({
					sw: document.documentElement.scrollWidth,
					main: document.querySelector('main')?.scrollWidth ?? 0,
					mainW: document.querySelector('main')?.clientWidth ?? 0,
					mainTop: document.querySelector('main')?.getBoundingClientRect().top ?? 0,
				}));
				const info = await holeInfo(page, sel);
				const cardsShown = s.title === 'Xem chi tiết' ? await page.evaluate(() => !!document.querySelector('ul[data-tour="asset-list"]')?.getClientRects().length) : true;
				// Phần tử cao hơn chỗ trống giữa đầu trang và tấm hướng dẫn thì không thể hiện trọn, tấm
				// được phép che phần dưới của nó.
				const room = info.view.height - geo.mainTop - (info.box.bottom - info.box.top) - 16;
				const tall = info.target && info.target.bottom - info.target.top > room;
				checks.push({ title: s.title, sheetFull: info.box && info.box.left <= 0.5 && info.box.right >= 389.5, covers: !tall && overlaps(info.box, info.target), cardsShown, sw: geo.sw, mainOverflow: geo.main > geo.mainW + 1 });
			},
		});
		record('Quản lý tài sản (ADMIN, điện thoại 390)', seen);
		const bad = checks.filter(c => !c.sheetFull || c.covers || !c.cardsShown || c.sw > 390 || c.mainOverflow);
		line('S11', seen.length === 5 && !bad.length && seen[2].body.startsWith('Chạm vào một tài sản'), 'Điện thoại 390: tấm dưới đáy không che phần tử, trỏ danh sách thẻ, không cuộn ngang', bad.length ? JSON.stringify(bad) : `${checks.length} bước đã đo, bước 3: "${seen[2]?.body}"`);
		await page.context().close();
	}

	// ─── S12: chế độ tối, cuộn và đổi cỡ cửa sổ ─────────────────────────────────────────
	if (want('S12')) {
		const page = await signIn(browser, WHO.admin, { dark: true });
		await openAssets(page);
		await waitShown(page, 20000);
		const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
		await goToStep(page, 'Tìm tài sản');
		const shotsDark = [await shot(page, 's12-toi-tim-tai-san')];
		const fit0 = holeFits(await holeInfo(page, '[data-tour="asset-filters"]'));
		// Cuộn vùng nội dung bằng code (lớp phủ chặn con lăn), ô sáng phải bám theo.
		await page.evaluate(() => document.querySelector('main')?.scrollBy(0, 160));
		await page.waitForTimeout(300);
		const fit1 = holeFits(await holeInfo(page, '[data-tour="asset-filters"]'));
		await page.setViewportSize({ width: 1024, height: 700 });
		await page.waitForTimeout(500);
		const fit2 = holeFits(await holeInfo(page, '[data-tour="asset-filters"]'));
		shotsDark.push(await shot(page, 's12-toi-sau-doi-co'));
		await page.setViewportSize({ width: 1440, height: 900 });
		await goToStep(page, 'Điền thông tin');
		shotsDark.push(await shot(page, 's12-toi-dien-thong-tin'));
		const fitForm = holeFits(await holeInfo(page, '[data-tour="asset-form-main"]'));
		line('S12', dark && fit0 && fit1 && fit2 && fitForm, 'Chế độ tối; cuộn và đổi cỡ cửa sổ thì ô sáng bám đúng', `tối=${dark}, ban đầu=${fit0}, sau cuộn=${fit1}, sau đổi cỡ=${fit2}, trong khung thêm tài sản=${fitForm}`);
		shots.S12 = shotsDark;
		await page.context().close();
	}

	// ─── S13: nút trợ lý AI và thông báo nhỏ ────────────────────────────────────────────
	if (want('S13')) {
		const page = await signIn(browser, WHO.employeePending);
		// `incident_id` không có thật làm trang tự hiện một thông báo đúng lúc tour tự hiện.
		await page.goto(`${WEB}/assets/my?incident_id=999999`, { waitUntil: 'domcontentloaded' });
		await waitShown(page, 20000);
		await page.locator('div.fixed.top-4.right-4 [role="alert"]').first().waitFor({ timeout: 10000 });
		const res = await page.evaluate(() => {
			const toastEl = document.querySelector('div.fixed.top-4.right-4 [role="alert"]');
			const tr = toastEl.getBoundingClientRect();
			const topAtToast = document.elementFromPoint(tr.left + tr.width / 2, tr.top + tr.height / 2);
			const dialog = document.querySelector('[data-tour-overlay] [role="dialog"]');
			const box = dialog.getBoundingClientRect();
			const fab = document.querySelector('.fixed.right-5.bottom-24');
			const fr = fab?.getBoundingClientRect();
			const topAtFab = fr ? document.elementFromPoint(fr.left + fr.width / 2, fr.top + fr.height / 2) : null;
			const pts = [
				[box.left + 10, box.top + 10],
				[box.right - 10, box.bottom - 10],
				[box.left + box.width / 2, box.top + box.height / 2],
			];
			return {
				toastOnTop: !!toastEl.contains(topAtToast),
				fabCovered: fr ? !!topAtFab?.closest('[data-tour-overlay]') : true,
				boxOnTop: pts.every(([x, y]) => dialog.contains(document.elementFromPoint(x, y))),
			};
		});
		shots.S13 = [await shot(page, 's13-thong-bao-tren-lop-phu')];
		line('S13', res.toastOnTop && res.fabCovered && res.boxOnTop, 'Thông báo nhỏ nằm trên lớp phủ; nút trợ lý nằm dưới, không đè hộp', JSON.stringify(res));
		await page.context().close();
	}

	// ─── S14: nút back của trình duyệt giữa chừng ────────────────────────────────────────
	if (want('S14')) {
		const page = await signIn(browser, WHO.admin);
		await page.goto(`${WEB}/`, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(1500);
		// Sang trang tài sản bằng điều hướng trong app (không tải lại trang), để nút back cũng là
		// điều hướng trong app: đó mới là lúc lớp phủ có thể sót lại.
		const viaLink = await page.evaluate(() => {
			const a = document.querySelector('a[href="/management/assets"]');
			a?.click();
			return !!a;
		});
		await waitShown(page, 20000);
		await next(page);
		await next(page);
		await page.goBack();
		await page.waitForTimeout(1500);
		const left = await page.evaluate(() => document.querySelectorAll('[data-tour-overlay]').length);
		const path = new URL(page.url()).pathname;
		// Trang `/` của ADMIN tự chuyển sang `/management`, nên back về đó.
		line('S14', viaLink && left === 0 && path !== '/management/assets', 'Back của trình duyệt giữa chừng: tour tắt, không sót lớp phủ', `sang trang bằng link=${viaLink}; back về ${path}, lớp phủ còn ${left}`);
		await page.context().close();
	}

	// ─── S15: localStorage bị chặn ──────────────────────────────────────────────────────
	if (want('S15')) {
		// Chặn từ trước khi tải trang thì chính app (plugin theme, store ui) chết trước khi tới tour,
		// nên thử hai cách nhắm đúng phần của tour.
		const page = await signIn(browser, WHO.admin);
		page.errors.length = 0;
		// (a) Mọi lần đọc ghi khoá `tour:` đều ném lỗi, từ lúc tải trang.
		await page.context().addInitScript(() => {
			const get = Storage.prototype.getItem;
			const set = Storage.prototype.setItem;
			Storage.prototype.getItem = function (k) {
				if (String(k).startsWith('tour:')) throw new DOMException('Bị chặn trong bài thử', 'SecurityError');
				return get.call(this, k);
			};
			Storage.prototype.setItem = function (k, v) {
				if (String(k).startsWith('tour:')) throw new DOMException('Bị chặn trong bài thử', 'QuotaExceededError');
				return set.call(this, k, v);
			};
		});
		await openAssets(page);
		let shownA = false;
		try {
			await waitShown(page, 20000);
			shownA = true;
		} catch {
			shownA = false;
		}
		const seenA = shownA ? await walk(page) : [];
		// Không nhớ được nên F5 lại tự hiện: đúng như yêu cầu "tour vẫn chạy, chỉ không nhớ".
		await page.reload({ waitUntil: 'domcontentloaded' });
		let again = false;
		try {
			await waitShown(page, 20000);
			again = true;
			await (await boxButton(page, 'Bỏ qua')).click();
		} catch {
			again = false;
		}
		// (b) Ngay cả việc chạm vào `window.localStorage` cũng ném lỗi, rồi bấm nút Hướng dẫn.
		await page.evaluate(() => {
			Object.defineProperty(window, 'localStorage', {
				configurable: true,
				get() {
					throw new DOMException('Bị chặn trong bài thử', 'SecurityError');
				},
			});
		});
		await page.locator(TOUR_BUTTON).click();
		let shownB = false;
		try {
			await waitShown(page, 10000);
			shownB = true;
		} catch {
			shownB = false;
		}
		const seenB = shownB ? await walk(page) : [];
		line(
			'S15',
			shownA && seenA.length === 5 && again && shownB && seenB.length === 5 && !page.errors.length,
			'localStorage bị chặn: tour vẫn chạy, không lỗi console, chỉ không nhớ đã xem',
			`(a) khoá tour ném lỗi: tự hiện=${shownA}, ${seenA.length} bước, F5 hiện lại=${again}; (b) window.localStorage ném lỗi: chạy=${shownB}, ${seenB.length} bước; lỗi console=${page.errors.length}${page.errors.length ? ` — ${page.errors.slice(0, 2).join(' | ').slice(0, 300)}` : ''}`,
		);
		await page.context().close();
	}
} finally {
	await browser.close();
	if (!only.size) {
		writeFileSync(`${SHOTS}/steps-text.json`, JSON.stringify(texts, null, 2));
		writeFileSync(`${SHOTS}/shots.json`, JSON.stringify(shots, null, 2));
	}
	process.exitCode = summary() ? 1 : 0;
}
