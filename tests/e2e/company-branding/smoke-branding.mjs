/**
 * Logo, favicon và tiêu đề tab theo công ty — kịch bản F1..F9 trong bàn giao của BE.
 *
 * F10 (mã nhân viên theo công ty) ở `smoke-employee-code.mjs` vì nó TẠO dữ liệu trên sandbox,
 * tách ra để chạy lại F1..F9 bao nhiêu lần cũng không thêm nhân viên nào.
 *
 *   SMOKE_PASSWORD='<mật khẩu sandbox>' node tests/e2e/company-branding/smoke-branding.mjs
 */
import {
	API,
	WHO,
	apiCompanies,
	clean,
	fetchHead,
	go,
	iconLinks,
	imgInfo,
	launch,
	line,
	newPage,
	rotateTab,
	shot,
	signIn,
	stampTab,
	summary,
	titleWhenReady,
	waitImg,
} from './helper.mjs';

const COMPANY_LOGO = '[data-testid="sidebar-company-logo"]';
const APP_LOGO = '[data-testid="sidebar-app-logo"]';

const companies = await apiCompanies(WHO.adminBoth.email);
const withLogo = companies.find(c => c.logoUrl);
const withoutLogo = companies.find(c => !c.logoUrl);
if (!withLogo || !withoutLogo) {
	console.error('Sandbox phải có một công ty CÓ logo và một công ty CHƯA có, đang thấy:', companies);
	process.exit(2);
}
console.log(`Công ty có logo: ${withLogo.name} (${withLogo.code})`);
console.log(`Công ty chưa có logo: ${withoutLogo.name} (${withoutLogo.code})`);

/**
 * Request trả mã lỗi trong lượt vừa rồi — in ra để báo lại, KHÔNG tính thành khẳng định đỏ.
 *
 * Đây là chuyện của dữ liệu sandbox và của endpoint, không phải của logo hay tiêu đề; trộn vào
 * phép kiểm "không lỗi JS" thì một bảng thiếu dữ liệu cũng làm cả bài đỏ.
 */
function reportNet(page, label) {
	const seen = [...new Set(page.netFails)];
	if (seen.length) console.log(`  ⓘ ${label}: ${seen.length} request trả mã lỗi → ${seen.join(' | ')}`);
}

/** Tiêu đề đúng dạng `{tên công ty} - {tên trang}` và nói đúng tên trang. */
function expectTitle(title, companyName, pageName, label) {
	const want = `${companyName} - ${pageName}`;
	line(title === want, label, `thực tế "${title}", mong đợi "${want}"`);
}

const browser = await launch();

// ════════════════════ F1 + F3 (có favicon) + F4: công ty có logo ════════════════════
{
	let page = await signIn(browser, WHO.adminBoth.email, { company: withLogo.code });

	// ── F1: logo công ty trên thanh bên ──
	const logo = await waitImg(page, COMPANY_LOGO);
	line(logo !== null, 'F1 thanh bên hiện logo công ty');
	if (logo) {
		line(logo.src === withLogo.logoUrl, 'F1 dùng NGUYÊN url máy chủ trả, cả tham số ?v=', `src=${logo.src}`);
		line(logo.naturalWidth > 0, 'F1 ảnh tải được thật, không phải thẻ rỗng', JSON.stringify(logo));
		// Người vận hành tải ảnh tỉ lệ tuỳ ý, nên cái phải đúng là TỈ LỆ chứ không phải số đo.
		const natural = logo.naturalWidth / logo.naturalHeight;
		const drawn = logo.width / logo.height;
		line(
			Math.abs(natural - drawn) < 0.02,
			'F1 logo giữ đúng tỉ lệ, không bị bóp méo',
			`ảnh gốc ${logo.naturalWidth}x${logo.naturalHeight} (${natural.toFixed(2)}), vẽ ra ${logo.width}x${logo.height} (${drawn.toFixed(2)})`,
		);
		line(logo.height <= 40, 'F1 logo nằm trong chiều cao khung thanh bên', `cao ${logo.height}px`);
	}
	line((await imgInfo(page, APP_LOGO)) === null, 'F1 không vẽ thêm logo mặc định của app');
	await shot(page, 'F1-thanh-ben-co-logo', { selector: 'aside' });
	await stampTab(page);
	await shot(page, 'F1-toan-trang-co-logo');

	// ── F1b: thanh bên thu gọn ──
	await page.getByRole('button', { name: 'Ẩn hiện thanh bên' }).first().click();
	await page.waitForTimeout(900);
	const railWidth = await page.evaluate(() => document.querySelector('aside').getBoundingClientRect().width);
	line(railWidth < 100, 'F1b thanh bên đã thu gọn', `rộng ${railWidth}px`);
	const small = await waitImg(page, COMPANY_LOGO);
	line(small !== null && small.naturalWidth > 0, 'F1b thu gọn vẫn thấy logo công ty', JSON.stringify(small));
	if (small) {
		line(
			small.left >= 0 && small.right <= railWidth + 0.5,
			'F1b logo nằm gọn trong thanh đã thu, không tràn ra ngoài',
			`logo ${small.left}..${small.right}, thanh rộng ${railWidth}`,
		);
		// Thu gọn thì khung cố định cả hai chiều, nên tỉ lệ của KHUNG không còn là tỉ lệ của ảnh.
		// Thứ giữ cho ảnh không bị bóp méo lúc này là `object-fit: contain`, nên kiểm đúng nó.
		line(small.objectFit === 'contain', 'F1b thu gọn ảnh co theo khung chứ không bị bóp méo', `object-fit: ${small.objectFit}`);
	}
	await shot(page, 'F1b-thanh-ben-thu-gon', { selector: 'aside' });
	await page.getByRole('button', { name: 'Ẩn hiện thanh bên' }).first().click();
	await page.waitForTimeout(700);

	// ── F3: favicon của công ty ──
	const icons = await iconLinks(page);
	line(icons.length === 1, 'F3 chỉ có MỘT thẻ rel="icon", không để hai thẻ tranh nhau', JSON.stringify(icons));
	line(icons[0]?.raw === withLogo.faviconUrl, 'F3 favicon trỏ đúng url công ty', JSON.stringify(icons));
	const iconRes = await fetchHead(page, icons[0]?.href ?? '');
	line(iconRes.status === 200, 'F3 favicon công ty tải được', JSON.stringify(iconRes));
	line(String(iconRes.type).startsWith('image/'), 'F3 favicon trả về đúng kiểu ảnh', JSON.stringify(iconRes));

	// ── F4: tiêu đề tab mọi trang ──
	const PAGES = [
		['/management/leave', 'Nghỉ phép'],
		['/management/employees', 'Nhân viên'],
		['/management/assets', 'Quản lý tài sản'],
		['/management/assets/reports', 'Báo cáo tài sản'],
		['/management/recruitment', 'Tổng quan tuyển dụng'],
		['/management/contracts', 'Quản lý hợp đồng'],
		['/management/settings/shifts', 'Quản lý ca làm việc'],
		['/assistant', 'Trợ lý nhân sự'],
		['/profile', 'Hồ sơ cá nhân'],
		['/notifications', 'Thông báo'],
		['/management/employees/new', 'Thêm nhân viên mới'],
		// Trang chưa khai `title` thì phải lấy nhãn mục menu, không được ra chữ `Booking`.
		['/management/employees/1', 'Chi tiết nhân viên'],
	];
	/**
	 * Công ty trên sandbox chưa mở hết phân hệ, mà `module-guard` đá người dùng khỏi phân hệ
	 * chưa mở. Trang bị đá thì không còn là trang đó nữa nên không kiểm tiêu đề của nó — và ghi
	 * ra danh sách đã bỏ qua, chứ không tính thành một khẳng định xanh.
	 */
	const skipped = [];
	let checked = 0;
	let since = 0;
	for (const [path, pageName] of PAGES) {
		if (++since >= 8) {
			page = await rotateTab(page);
			since = 0;
		}
		await go(page, path, 2200);
		if (new URL(page.url()).pathname !== path) {
			skipped.push(path);
			continue;
		}
		checked += 1;
		expectTitle(await titleWhenReady(page), withLogo.name, pageName, `F4 ${path}`);
	}
	if (skipped.length) console.log(`  ↑ bỏ qua ${skipped.length} trang công ty chưa mở phân hệ: ${skipped.join(', ')}`);
	line(checked >= 8, 'F4 kiểm được đủ nhiều trang để kết luận', `chỉ kiểm được ${checked} trang`);
	await go(page, '/management/leave', 2200);
	await stampTab(page);
	await shot(page, 'F4-tieu-de-tab-nghi-phep');

	// Quét rộng: không trang nào còn ra chữ `Booking`, và trang nào cũng mang tên công ty.
	const SWEEP = [
		'/management',
		'/management/attendance',
		'/management/approval',
		'/management/overtime',
		'/management/online-work',
		'/management/violations',
		'/management/business-trips',
		'/management/departments',
		'/management/positions',
		'/management/payroll',
		'/management/reports',
		'/management/roles',
		'/management/settings',
		'/management/system-logs',
		'/management/announcements',
		'/management/recruitment/jobs',
		'/management/recruitment/candidates',
		'/management/assets/vendors',
		'/general-requests',
		'/attendance/my',
		'/users/leave-requests',
		'/assets/my',
	];
	const bad = [];
	let swept = 0;
	since = 0;
	for (const path of SWEEP) {
		if (++since >= 8) {
			page = await rotateTab(page);
			since = 0;
		}
		await go(page, path, 1400);
		const title = await titleWhenReady(page);
		// Trang bị `module-guard` đá sang chỗ khác thì vẫn phải có tiêu đề tử tế, chỉ là không
		// phải tiêu đề của trang này — nên chỉ bỏ qua phép so đường dẫn, không bỏ qua phép so chữ.
		if (new URL(page.url()).pathname === path) swept += 1;
		if (/Booking/i.test(title) || !title.startsWith(`${withLogo.name} - `) || title.endsWith(' - ')) {
			bad.push(`${path} → "${title}"`);
		}
	}
	line(
		bad.length === 0,
		`F4 quét ${SWEEP.length} trang khác (${swept} trang mở đúng chỗ): không còn "Booking", trang nào cũng có tên công ty`,
		bad.join(' | '),
	);

	line(page.errors.length === 0, 'F1–F4 không lỗi JS', page.errors.slice(0, 3).join(' | '));
	reportNet(page, 'F1–F4');
	await page.context().close();
}

// ════════════════════ F4b: trang tự gọi useHead vẫn được gắn tên công ty ════════════════════
// Phần lớn trang khai tên qua `definePageMeta`, nhưng vài trang tự gọi `useHead({ title })`.
// Hai đường đó phải ra cùng một kết quả, nếu không thì sửa một chỗ lại hỏng chỗ kia.
{
	const page = await newPage(browser, {
		route: async p => {
			// Công ty trên sandbox chưa mua phân hệ Tuyển dụng nên `module-guard` chặn trước khi
			// trang kịp đặt tiêu đề. Sửa câu trả lời của API NGAY TRONG TRÌNH DUYỆT để mở khoá —
			// không đụng gì tới sandbox, tắt trình duyệt là hết.
			await p.route('**/v1/me/entitlements*', async r => {
				const res = await r.fetch();
				const body = await res.json();
				body.data.modules = (body.data.modules ?? []).map(m =>
					m.code === 'RECRUIT' ? { ...m, state: 'ENABLED', reason: null } : m,
				);
				await r.fulfill({ response: res, json: body });
			});
		},
	});
	await signIn(browser, WHO.adminBoth.email, { page, company: withLogo.code });
	await go(page, '/recruitment/my-interviews', 4000);
	const title = await titleWhenReady(page);
	line(
		title === `${withLogo.name} - Phỏng vấn của tôi`,
		'F4b trang tự đặt tiêu đề bằng useHead vẫn được gắn tên công ty',
		title,
	);
	await stampTab(page);
	await shot(page, 'F4b-trang-tu-dat-tieu-de');
	await page.context().close();
}

// ════════════════════ F2 + F3 (chưa có favicon): công ty chưa có logo ════════════════════
{
	const page = await signIn(browser, WHO.adminB.email);
	const app = await waitImg(page, APP_LOGO);
	line((await imgInfo(page, COMPANY_LOGO)) === null, 'F2 công ty chưa có logo thì không vẽ thẻ ảnh công ty');
	line(app !== null, 'F2 thanh bên quay về logo mặc định của app');
	if (app) {
		line(/app-logo-(light|dark)-mode\.svg$/.test(app.src), 'F2 logo app chọn theo theme như trước', `src=${app.src}`);
		line(app.naturalWidth > 0, 'F2 logo app tải được', JSON.stringify(app));
	}
	const icons = await iconLinks(page);
	line(icons.length === 1 && icons[0].raw === '/favicon.svg', 'F3 chưa có favicon riêng thì giữ /favicon.svg', JSON.stringify(icons));
	expectTitle(await titleWhenReady(page), withoutLogo.name, 'Dashboard', 'F2 tiêu đề vẫn mang tên công ty');
	await shot(page, 'F2-thanh-ben-khong-logo', { selector: 'aside' });
	await stampTab(page);
	await shot(page, 'F2-toan-trang-khong-logo');
	line(page.errors.length === 0, 'F2 không lỗi JS', page.errors.slice(0, 3).join(' | '));
	reportNet(page, 'F2');
	await page.context().close();
}

// ════════════════════ F5: trang chưa đăng nhập và trang của người ngoài ════════════════════
{
	// Đăng nhập rồi đăng xuất, để chắc tên công ty của phiên cũ không còn sót trên tab.
	const page = await signIn(browser, WHO.adminBoth.email, { company: withLogo.code });
	await page.locator('[data-user-menu] button').first().click();
	await page.waitForTimeout(600);
	await page.getByRole('button', { name: /Đăng xuất/i }).first().click();
	await page.waitForTimeout(3500);

	const loginTitle = await titleWhenReady(page);
	line(
		loginTitle === 'Hệ thống nhân sự - Đăng nhập',
		'F5 trang đăng nhập mang tên sản phẩm, không mang tên công ty',
		loginTitle,
	);
	line(!loginTitle.includes(withLogo.name), 'F5 không còn tên công ty của phiên cũ', loginTitle);
	const loginIcons = await iconLinks(page);
	line(
		loginIcons.length === 1 && loginIcons[0].raw === '/favicon.svg',
		'F5 favicon về của app sau khi đăng xuất',
		JSON.stringify(loginIcons),
	);
	await stampTab(page);
	await shot(page, 'F5-dang-nhap-khong-ten-cong-ty');

	await go(page, '/forgot-password', 2000);
	line((await titleWhenReady(page)) === 'Hệ thống nhân sự - Quên mật khẩu', 'F5 trang quên mật khẩu', await titleWhenReady(page));

	// Trang tuyển dụng công khai: chỉ còn tên trang, không gắn tên sản phẩm cũng không gắn công ty.
	await go(page, `/careers/${withLogo.code}`, 3000);
	const careers = await titleWhenReady(page);
	line(
		!careers.startsWith('Hệ thống nhân sự - ') && careers !== '',
		'F5 trang tuyển dụng công khai chỉ còn tên trang',
		careers,
	);
	await stampTab(page);
	await shot(page, 'F5-trang-tuyen-dung-cong-khai');
	await page.context().close();
}

// ── F5b: đang đăng nhập ở công ty A mở trang của người ngoài ──
{
	const page = await signIn(browser, WHO.adminBoth.email, { company: withLogo.code });
	await go(page, '/offer-response', 3000);
	const title = await titleWhenReady(page);
	line(
		title === 'Thư mời nhận việc',
		'F5b trang phản hồi thư mời không mượn tên công ty của phiên đang mở',
		title,
	);
	const icons = await iconLinks(page);
	line(
		icons.length === 1 && icons[0].raw === '/favicon.svg',
		'F5b trang của người ngoài dùng favicon của app, không dùng favicon công ty',
		JSON.stringify(icons),
	);
	await stampTab(page);
	await shot(page, 'F5b-thu-moi-khong-ten-cong-ty');
	await page.context().close();
}

// ════════════════════ F6: đổi công ty ở header ════════════════════
{
	const page = await signIn(browser, WHO.adminBoth.email, { company: withLogo.code });
	line((await waitImg(page, COMPANY_LOGO)) !== null, 'F6 bắt đầu ở công ty có logo');

	await page.locator('[data-testid="company-switcher"]').click();
	await page.waitForTimeout(700);
	// Logo nhỏ cạnh tên công ty trong danh sách chọn.
	const menuLogos = await page.locator('[data-testid="company-menu"] [data-testid="company-logo"]').count();
	line(menuLogos >= 1, 'F6 danh sách công ty vẽ logo nhỏ cạnh tên', `thấy ${menuLogos} logo`);
	await shot(page, 'F6-danh-sach-cong-ty');

	await page.locator(`[data-company-code="${withoutLogo.code}"]`).click();
	// `switchCompany` tải lại cả trang (xem store auth), nên chờ thanh bên dựng lại.
	await page.locator('aside').first().waitFor({ state: 'visible', timeout: 60000 });
	await page.waitForTimeout(3500);

	line((await waitImg(page, APP_LOGO)) !== null, 'F6 về logo mặc định của app');
	line((await imgInfo(page, COMPANY_LOGO)) === null, 'F6 sang công ty chưa có logo thì không còn logo cũ');
	const icons = await iconLinks(page);
	line(icons.length === 1 && icons[0].raw === '/favicon.svg', 'F6 favicon đổi theo công ty mới', JSON.stringify(icons));
	const title = await titleWhenReady(page);
	line(
		title.startsWith(`${withoutLogo.name} - `),
		'F6 tiêu đề tab đổi sang tên công ty mới',
		title,
	);
	line(!title.includes(withLogo.name), 'F6 không còn tên công ty cũ trên tab', title);
	await stampTab(page);
	await shot(page, 'F6-sau-khi-doi-cong-ty');
	line(page.errors.length === 0, 'F6 không lỗi JS', page.errors.slice(0, 3).join(' | '));
	reportNet(page, 'F6');
	await page.context().close();
}

// ════════════════════ F7: url logo trả 404 ════════════════════
{
	// Người vận hành vừa gỡ logo: url còn trong phiên nhưng máy chủ đã trả 404. Chặn ngay ở
	// tầng mạng thay vì sửa store, để đúng cái `@error` của thẻ ảnh phải xử lý được kiểm thật.
	const page = await newPage(browser, {
		route: async p => {
			await p.route(withLogo.logoUrl, r =>
				r.fulfill({
					status: 404,
					contentType: 'application/json',
					body: JSON.stringify({ success: false, error: { code: 'COMPANY_IMAGE_NOT_FOUND' } }),
				}),
			);
		},
	});
	await signIn(browser, WHO.adminBoth.email, { page, company: withLogo.code });
	await page.waitForTimeout(1500);

	const app = await waitImg(page, APP_LOGO);
	line((await imgInfo(page, COMPANY_LOGO)) === null, 'F7 logo 404 thì bỏ thẻ ảnh công ty, không để ảnh vỡ');
	line(app !== null && app.naturalWidth > 0, 'F7 quay về logo mặc định của app', JSON.stringify(app));
	// Tiêu đề và favicon không liên quan tới logo nên phải còn nguyên.
	line((await titleWhenReady(page)).startsWith(`${withLogo.name} - `), 'F7 tiêu đề tab không bị ảnh hưởng', await titleWhenReady(page));
	await shot(page, 'F7-thanh-ben-logo-404', { selector: 'aside' });
	await stampTab(page);
	await shot(page, 'F7-logo-404-ve-logo-app');
	await page.context().close();
}

// ════════════════════ F8: mọi vai trò đọc cùng một thứ ════════════════════
for (const key of ['hr', 'manager', 'employee']) {
	const who = WHO[key];
	const page = await signIn(browser, who.email);
	const logo = await waitImg(page, COMPANY_LOGO);
	line(logo !== null && logo.naturalWidth > 0, `F8 ${who.label} thấy logo công ty`, JSON.stringify(logo));
	if (logo) line(logo.src === withLogo.logoUrl, `F8 ${who.label} dùng đúng url logo`, `src=${logo.src}`);
	const icons = await iconLinks(page);
	line(
		icons.length === 1 && icons[0].raw === withLogo.faviconUrl,
		`F8 ${who.label} thấy favicon công ty`,
		JSON.stringify(icons),
	);
	const title = await titleWhenReady(page);
	line(title.startsWith(`${withLogo.name} - `), `F8 ${who.label} tiêu đề mang tên công ty`, title);
	line(!/Booking/i.test(title), `F8 ${who.label} không còn chữ Booking`, title);
	await stampTab(page);
	await shot(page, `F8-${key}`);
	line(page.errors.length === 0, `F8 ${who.label} không lỗi JS`, page.errors.slice(0, 3).join(' | '));
	reportNet(page, `F8 ${who.label}`);
	await page.context().close();
}

// ════════════════════ F9: hướng dẫn cột A trong modal nhập Excel ════════════════════
{
	const page = await signIn(browser, WHO.hr.email);
	await go(page, '/management/employees', 3000);
	await page.getByRole('button', { name: /Import Excel/i }).first().click();
	const modal = page.locator('[role="dialog"], .fixed').filter({ hasText: 'Tải file mẫu' }).first();
	await modal.waitFor({ state: 'visible', timeout: 20000 });
	const text = clean(await modal.innerText());
	line(
		text.includes('công ty đã có mã nhân viên thì để trống, hệ thống tự cấp mã theo thứ tự dòng'),
		'F9 modal nhập Excel có dòng hướng dẫn cột Mã nhân viên',
		text.slice(0, 400),
	);
	line(
		text.includes('mã ghi ở cột này chỉ dùng để cột Mã quản lý trỏ tới người trong cùng file'),
		'F9 nói rõ mã ghi ở cột A chỉ là khoá trong file',
		text.slice(0, 400),
	);
	await shot(page, 'F9-huong-dan-cot-ma-nhan-vien');
	line(page.errors.length === 0, 'F9 không lỗi JS', page.errors.slice(0, 3).join(' | '));
	reportNet(page, 'F9');
	await page.context().close();
}

console.log(`\nSandbox API: ${API}`);
await browser.close();
process.exit(summary() === 0 ? 0 : 1);
