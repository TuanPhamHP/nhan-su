/**
 * F1, F2, F3, F5 — hai loại thông báo chuyển nhân viên giữa hai công ty.
 *
 *   SMOKE_PASSWORD='<mật khẩu sandbox>' node tests/e2e/employee-transfer/smoke-transfer.mjs
 *
 * F4 (nhận lời mời) nằm ở `smoke-accept-invite.mjs`: link lời mời dùng một lần, nên bài này chạy
 * lại bao nhiêu lần cũng được còn bài kia chỉ chạy được một lần.
 */
import {
	API,
	TITLE_IN,
	TITLE_OUT,
	WHO,
	apiLogin,
	apiNotifications,
	bellBadge,
	bellItem,
	clean,
	closeBell,
	go,
	launch,
	line,
	note,
	openBell,
	shot,
	shotStrip,
	signIn,
	summary,
} from './helper.mjs';

const browser = await launch();

/**
 * Lỗi JS của một tab, kiểm trước khi đóng context.
 *
 * Mỗi kịch bản dùng một context riêng (phiên đăng nhập khác nhau), đóng context là mất sổ lỗi,
 * nên phải chốt sổ ngay tại chỗ chứ không gom hết về cuối bài.
 */
function checkPageErrors(page, tag) {
	line(page.errors.length === 0, `${tag} không lỗi JS trên các trang đã mở`, page.errors.slice(0, 3).join(' | '));
	const net = [...new Set(page.netFails)];
	if (net.length) note(`${tag}: ${net.length} request trả mã lỗi → ${net.join(' | ')}`);
}

/** Mã nhân viên của một hồ sơ, đọc từ API để so với chữ trên màn hình. */
async function employeeCode(token, id) {
	const res = await fetch(`${API}/v1/employees/${id}`, { headers: { Authorization: `Bearer ${token}` } });
	if (!res.ok) return null;
	return (await res.json()).data?.employeeCode ?? null;
}

/** Mở chuông, kiểm tiêu đề và số dòng, chụp ảnh, rồi bấm một dòng cụ thể và kiểm trang mở ra. */
async function checkBell({ page, who, token, title, otherTitle, list, tag, pickCode }) {
	const expected = list.filter(n => n.title === title);

	const badge = await bellBadge(page);
	line(
		badge === String(expected.filter(n => !n.isRead).length) || expected.every(n => n.isRead),
		`${tag} huy hiệu chuông khớp số thông báo chưa đọc của API`,
		`chuông=${badge} api=${expected.filter(n => !n.isRead).length}`,
	);

	const panel = await openBell(page);
	line(panel.includes(title), `${tag} chuông hiện đúng tiêu đề "${title}"`, panel.slice(0, 200));
	line(!panel.includes(otherTitle), `${tag} chuông KHÔNG lẫn tiêu đề của công ty bên kia`, panel.slice(0, 200));

	const rows = await bellItem(page, title).count();
	line(rows === expected.length, `${tag} chuông hiện ${expected.length} dòng`, `thấy ${rows}`);

	// Thông báo cố ý không nêu tên công ty kia; kiểm cả hai tên để chắc chắn không lộ.
	const leaked = ['Công ty alpha', 'Công ty beta', 'Công ty gamma'].filter(name => panel.includes(name));
	line(leaked.length === 0, `${tag} nội dung thông báo không nêu tên công ty kia`, leaked.join(', '));

	const shotPath = await shotStrip(page, `${tag}-chuong`);
	note(`ảnh chuông: ${shotPath}`);

	// Dòng cần bấm: chọn theo mã nhân viên trong nội dung, không theo thứ tự hiển thị.
	const target = expected.find(n => n.body.includes(pickCode));
	if (!target) {
		line(false, `${tag} tìm được dòng của ${pickCode} để bấm`, expected.map(n => n.body).join(' | '));
		return;
	}
	await page.locator('[data-notif-panel] > div p', { hasText: pickCode }).first().click();
	await page.waitForURL(url => /\/management\/employees\/\d+/.test(url.toString()), { timeout: 30000 });
	await page.waitForTimeout(3000);

	const url = new URL(page.url());
	line(
		url.pathname === target.targetUrl,
		`${tag} bấm vào mở đúng trang máy chủ chỉ (${target.targetUrl})`,
		`đang ở ${url.pathname}${url.search}`,
	);

	const code = await employeeCode(token, target.refId);
	const body = clean(await page.locator('body').innerText());
	line(!!code && body.includes(code), `${tag} trang mở ra là hồ sơ của ${code}`, `mã API=${code}`);
	line(!body.includes('404') && !body.includes('Không tìm thấy'), `${tag} trang mở ra không phải trang lỗi`);

	const openShot = await shot(page, `${tag}-ho-so`);
	note(`ảnh trang mở ra: ${openShot}`);
	note(`${who}: ${expected.length} thông báo, refId ${expected.map(n => n.refId).join(', ')}`);
}

// ─── F1: HR, admin công ty nhận ───────────────────────────────────────────────
const beta = await apiNotifications(WHO.adminBeta.email);
line(
	beta.list.length > 0 && beta.list.every(n => n.type === 'EMPLOYEE_TRANSFERRED_IN'),
	'F1 API: hộp thông báo công ty nhận chỉ có EMPLOYEE_TRANSFERRED_IN',
	[...new Set(beta.list.map(n => n.type))].join(', '),
);
line(
	beta.list.every(n => n.refType === 'employee' && n.actionType === 'NAVIGATE_ONLY' && n.category === 'EVENT'),
	'F1 API: refType employee, NAVIGATE_ONLY, category EVENT như bridge doc',
	beta.list.map(n => `${n.refType}/${n.actionType}/${n.category}`).join(' | '),
);

let page = await signIn(browser, WHO.adminBeta.email);
line(
	clean(await page.locator('[data-testid="company-switcher"], [data-testid="company-name"]').first().innerText()).includes(
		beta.auth.company.name,
	),
	'F1 vào đúng công ty nhận',
	beta.auth.company.name,
);
await checkBell({
	page,
	who: WHO.adminBeta.email,
	token: beta.auth.accessToken,
	title: TITLE_IN,
	otherTitle: TITLE_OUT,
	list: beta.list,
	tag: 'F1',
	pickCode: 'BETA-0002',
});

// Trang danh sách thông báo là đường bấm thứ hai, code khác chuông nên kiểm riêng.
await go(page, '/notifications', 4000);
const listText = clean(await page.locator('body').innerText());
line(listText.includes(TITLE_IN), 'F1b trang danh sách thông báo cũng hiện loại mới', listText.slice(0, 160));
const fromList = beta.list.find(n => n.body.includes('BETA-0003'));
// Mỗi dòng trong trang danh sách là một `<button>`, nên bấm theo nút chứ không theo thẻ chữ.
await page.locator('button', { hasText: 'BETA-0003' }).first().click();
await page.waitForURL(url => /\/management\/employees\/\d+/.test(url.toString()), { timeout: 30000 });
await page.waitForTimeout(2500);
line(
	new URL(page.url()).pathname === fromList.targetUrl,
	`F1b bấm từ trang danh sách cũng mở đúng ${fromList.targetUrl}`,
	page.url(),
);
note(`ảnh danh sách: ${await shot(page, 'F1b-tu-trang-danh-sach')}`);
checkPageErrors(page, 'F1');
await page.context().close();

// ─── F2: HR, admin công ty cũ ─────────────────────────────────────────────────
const alpha = await apiNotifications(WHO.adminAlpha.email);
line(
	alpha.list.length > 0 && alpha.list.every(n => n.type === 'EMPLOYEE_TRANSFERRED_OUT'),
	'F2 API: hộp thông báo công ty cũ chỉ có EMPLOYEE_TRANSFERRED_OUT',
	[...new Set(alpha.list.map(n => n.type))].join(', '),
);

page = await signIn(browser, WHO.adminAlpha.email);
await checkBell({
	page,
	who: WHO.adminAlpha.email,
	token: alpha.auth.accessToken,
	title: TITLE_OUT,
	otherTitle: TITLE_IN,
	list: alpha.list,
	tag: 'F2',
	pickCode: 'EMP101',
});

// "Vẫn đang làm": hồ sơ ở công ty cũ chưa bị xoá và chưa tự chuyển sang nghỉ việc.
const outTarget = alpha.list.find(n => n.body.includes('EMP101'));
const stillThere = await fetch(`${API}/v1/employees/${outTarget.refId}`, {
	headers: { Authorization: `Bearer ${alpha.auth.accessToken}` },
});
const stillJson = (await stillThere.json()).data ?? {};
line(stillThere.ok, 'F2 hồ sơ ở công ty cũ vẫn còn để HR làm thủ tục nghỉ việc', `HTTP ${stillThere.status}`);
note(`hồ sơ cũ: ${stillJson.employeeCode} trạng thái ${stillJson.status}`);

// HR công ty cũ cũng phải thấy, không chỉ admin.
const hrAlpha = await apiNotifications(WHO.hrAlpha.email);
line(
	hrAlpha.list.length > 0 && hrAlpha.list.every(n => n.type === 'EMPLOYEE_TRANSFERRED_OUT'),
	'F2b HR công ty cũ cũng nhận EMPLOYEE_TRANSFERRED_OUT',
	`${hrAlpha.list.length} thông báo`,
);
checkPageErrors(page, 'F2');
await page.context().close();

// ─── F3: người được chuyển hẳn đăng nhập bằng mật khẩu cũ ─────────────────────
const movedAuth = await apiLogin(WHO.moved.email);
line(
	!movedAuth.requiresCompanySelection && movedAuth.companies?.length === 1,
	'F3 API: tài khoản chỉ còn một công ty nên không có bước chọn công ty',
	JSON.stringify(movedAuth.companies?.map(c => c.code)),
);
line(
	movedAuth.company?.code !== 'alpha',
	'F3 API: công ty mặc định không còn là công ty cũ',
	`đang là ${movedAuth.company?.code}`,
);

page = await signIn(browser, WHO.moved.email);
const headerCompany = clean(
	await page.locator('[data-testid="company-switcher"], [data-testid="company-name"]').first().innerText(),
);
line(headerCompany.includes(movedAuth.company.name), 'F3 vào thẳng công ty mới', headerCompany);
line(!headerCompany.includes('alpha'), 'F3 thanh trên không còn tên công ty cũ', headerCompany);
line(
	(await page.locator('[data-testid="company-switcher"]').count()) === 0,
	'F3 không còn bộ chọn công ty, vì chỉ còn một công ty',
);
note(`ảnh thanh trên: ${await shot(page, 'F3-thanh-tren', { selector: 'header' })}`);

await go(page, '/profile', 5000);
const profile = clean(await page.locator('body').innerText());
line(
	profile.includes(movedAuth.user.employeeCode),
	`F3 hồ sơ cá nhân hiện mã theo công ty mới (${movedAuth.user.employeeCode})`,
	profile.slice(0, 200),
);
line(/^BETA-/.test(movedAuth.user.employeeCode), 'F3 mã nhân viên là mã của công ty mới', movedAuth.user.employeeCode);
line(!profile.includes('Công ty alpha'), 'F3 trang cá nhân không còn dấu vết công ty cũ');
note(`ảnh hồ sơ cá nhân: ${await shot(page, 'F3-ho-so-ca-nhan')}`);

// ─── F5: nhân viên thường không nhận hai loại này ─────────────────────────────
const movedNotis = await apiNotifications(WHO.moved.email);
const transferForEmployee = movedNotis.list.filter(n => String(n.type).startsWith('EMPLOYEE_TRANSFERRED'));
line(
	transferForEmployee.length === 0,
	'F5 API: nhân viên thường không có thông báo chuyển nhân viên nào',
	transferForEmployee.map(n => n.type).join(', '),
);

await go(page, '/', 4000);
const bell = await openBell(page);
line(!bell.includes(TITLE_IN) && !bell.includes(TITLE_OUT), 'F5 chuông của nhân viên không có hai loại này', bell.slice(0, 200));
line(
	movedNotis.list.length > 0 || bell.includes('Không có thông báo nào'),
	'F5 chuông nhất quán với API',
	`api=${movedNotis.list.length} chuông="${bell.slice(0, 120)}"`,
);
note(`ảnh chuông nhân viên: ${await shotStrip(page, 'F5-chuong-nhan-vien')}`);
await closeBell(page);
checkPageErrors(page, 'F3/F5');

await browser.close();
process.exit(summary() === 0 ? 0 : 1);
