// Sandbox dùng một lần cho form danh mục Văn phòng phẩm (P1): Postgres 55477, Redis 56477, API 3176, mã BE ở
// hr-system-be/dist. Dựng bằng `.sandbox-supply/drill-p1.cjs` (sinh từ make-drill.cjs), nên không chạm DB thật.
// Mật khẩu đọc từ drill lúc chạy, không ghi ở đây. Tài khoản ghi ra `.sandbox-supply/p1-accounts.json`.
//
//   node tests/e2e/supply-catalog/sandbox.cjs     dựng, nạp dữ liệu, giữ chạy tới khi Ctrl+C (tự dọn container)
const fs = require('fs');
const path = require('path');
const drill = require('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs');

const seed = require(path.join(drill.ROOT, 'dist/tenancy/bootstrap/bootstrap-seed.js'));
const ACCOUNTS = '/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json';

async function api(token, method, url, body) {
	const res = await fetch(`${drill.API}${url}`, {
		method,
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
	let json = null;
	try {
		json = await res.json();
	} catch {
		/* không có body */
	}
	if (res.status >= 300) throw new Error(`${method} ${url}: ${res.status} ${JSON.stringify(json)}`);
	return json.data;
}

let company;

async function addEmployee(platform, email, fullName, role, departmentId) {
	const bcrypt = require(require.resolve('bcrypt', { paths: [drill.ROOT] }));
	const c = drill.tenantClient(company.url);
	const emp = await c.employee.create({
		data: {
			employeeCode: `E${Math.floor(Math.random() * 1e6)}`,
			fullName,
			email,
			passwordHash: 'unused',
			role,
			status: 'ACTIVE',
			joinDate: new Date('2026-01-01'),
			departmentId,
		},
	});
	await seed.assignDefaultRoles(c, await seed.defaultRoleMap(c), () => undefined);
	const tenant = await platform.tenant.findUnique({ where: { code: company.code } });
	const account = await platform.account.create({
		data: { displayName: fullName, passwordHash: await bcrypt.hash(drill.PASSWORD, 4) },
	});
	await platform.accountIdentity.create({
		data: { accountId: account.id, type: 'EMAIL', value: email, verifiedAt: new Date(), isPrimary: true },
	});
	await platform.membership.create({
		data: { accountId: account.id, tenantId: tenant.id, employeeId: emp.id, status: 'ACTIVE' },
	});
	await c.employee.update({ where: { id: emp.id }, data: { accountId: account.id } });
	await c.$disconnect();
	return emp.id;
}

const PENS = [
	['Bút bi (Note màu xanh)', 'Chiếc'],
	['Bút bi (Note màu đỏ)', 'Chiếc'],
	['Bút chì gỗ', 'Chiếc'],
	['Gọt bút chì', 'Chiếc'],
	['Tẩy', 'Chiếc'],
	['Bút highlight', 'Chiếc'],
	['Bút lông viết bảng', 'Chiếc'],
	['Bút xoá nước', 'Chiếc'],
	['Kẹp sắt size nhỏ (19mm)', 'Hộp'],
	['Kẹp sắt size vừa (25mm)', 'Hộp'],
	['Kẹp sắt size to (41mm)', 'Hộp'],
	['Ghim bấm số 10', 'Hộp'],
	['Ghim cài', 'Hộp'],
	['Dập ghim số 10', 'Chiếc'],
	['Gỡ ghim', 'Chiếc'],
	['Băng dính trong 5cm', 'Cuộn'],
	['Băng dính hai mặt 1cm loại dày dành cho dán bảng thông báo và khung ảnh treo tường', 'Cuộn'],
];
const PAPERS = [
	['Giấy A4 Double A 80gsm', 'Ram'],
	['Giấy A3', 'Ram'],
	['Giấy note vàng 3x3', 'Tập'],
	['Giấy note 5 màu', 'Tập'],
	['Sổ bìa da A5', 'Quyển'],
	['Sổ lò xo A4', 'Quyển'],
	['File lá A4', 'Chiếc'],
	['File còng 7cm', 'Chiếc'],
	['File còng 5cm', 'Chiếc'],
	['File hộp 10cm', 'Chiếc'],
	['Túi clear bag khuy bấm', 'Chiếc'],
	['Túi hồ sơ nilon', 'Chiếc'],
	['Bìa lỗ A4', 'Tập'],
	['Bìa trình ký', 'Chiếc'],
	['Phong bì A4', 'Chiếc'],
	['Phong bì A5', 'Chiếc'],
	['Phong bì thư dài', 'Chiếc'],
	['Giấy than', 'Hộp'],
	['Giấy in nhiệt K80', 'Cuộn'],
	['Nhãn dán file', 'Tập'],
	['Kệ tài liệu 3 ngăn', 'Chiếc'],
];

async function main() {
	await drill.startInfra();
	const platform = drill.platformClient();
	company = await drill.createCompany(platform, 'p1', 'P1 Supplies');
	const tenant = await platform.tenant.findUnique({ where: { code: 'p1' } });
	await platform.tenantModule.create({ data: { tenantId: tenant.id, moduleCode: 'OFFICE', status: 'ENABLED' } });

	const c = drill.tenantClient(company.url);
	const hcns = await c.department.create({ data: { name: 'Phòng Hành chính nhân sự' } });
	const kt = await c.department.create({ data: { name: 'Kế toán' } });
	await c.employee.update({ where: { id: company.employeeId }, data: { departmentId: kt.id } });
	await c.$disconnect();
	const hanhId = await addEmployee(platform, 'hanh@p1.drill', 'Đỗ Hồng Hạnh', 'MANAGER', hcns.id);
	await addEmployee(platform, 'quynh@p1.drill', 'Nguyễn Thị Hương Quỳnh', 'EMPLOYEE', hcns.id);
	await addEmployee(platform, 'tuan@p1.drill', 'Trần Minh Tuấn', 'EMPLOYEE', hcns.id);
	await platform.$disconnect();
	const c2 = drill.tenantClient(company.url);
	await c2.department.update({ where: { id: hcns.id }, data: { managerId: hanhId } });
	await c2.$disconnect();

	const app = await drill.startApi();
	console.log(`API log: ${app.logFile}`);
	const admin = await drill.login(company.email);
	const hanh = await drill.login('hanh@p1.drill');
	const quynh = await drill.login('quynh@p1.drill');

	const site = await api(admin, 'POST', '/office/sites', { name: 'Văn phòng Hà Nội' });
	const items = {};
	async function group(name, list, hrOnly = false) {
		const g = await api(admin, 'POST', '/office/supply-groups', { name, hrOnly });
		for (const [itemName, unit] of list) {
			items[itemName] = await api(admin, 'POST', '/office/supply-items', { groupId: g.id, name: itemName, unit });
		}
	}
	await group('Bút (Note màu) & các loại gim', PENS);
	await group('Sổ & Giấy & Các file lưu trữ tài liệu', PAPERS);
	await group('Đồ uống', [['Trà túi lọc', 'Hộp'], ['Cà phê gói', 'Hộp']], true);
	await group('Khác', [['Pin AA', 'Đôi']], true);
	await group('Vật dụng sử dụng vệ sinh', [['Giấy vệ sinh', 'Cuộn']], true);

	await api(admin, 'PUT', '/office/supply-quotas', {
		departmentId: hcns.id,
		quotas: [
			{ itemId: items['Bút bi (Note màu xanh)'].id, monthlyQty: 20 },
			{ itemId: items['Giấy A4 Double A 80gsm'].id, monthlyQty: 5 },
		],
	});

	// Kỳ tháng 11 (máy chủ không cho mở tháng đã qua): phòng đã nhập, HCNS khoá và chốt; nguồn cho "Lấy số tháng trước" và phiếu chỉ xem.
	const oct = await api(admin, 'POST', '/office/supply-periods', {
		officeSiteId: site.id,
		month: '2026-11',
		// Hạn chót không được trước hôm nay: lấy ngày chạy theo giờ Việt Nam.
		deadline: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10),
		departmentIds: [hcns.id, kt.id],
	});
	let mine = await api(hanh, 'GET', '/me/office/supply-requests');
	const octReq = mine.find(r => r.period.id === oct.id);
	const OL = `/me/office/supply-requests/${octReq.id}/lines`;
	await api(hanh, 'POST', OL, { itemId: items['Bút bi (Note màu xanh)'].id, requestedQty: 12, note: 'Mực xanh' });
	await api(hanh, 'POST', OL, { itemId: items['Bút chì gỗ'].id, requestedQty: 4 });
	await api(hanh, 'POST', OL, { itemId: items['Giấy A4 Double A 80gsm'].id, requestedQty: 3 });
	await api(hanh, 'POST', OL, { itemId: items['Sổ lò xo A4'].id, requestedQty: 2 });
	await api(quynh, 'POST', OL, { itemId: items['Tẩy'].id, requestedQty: 3 });
	await api(admin, 'POST', `/office/supply-periods/${oct.id}/lock`);
	const octFull = await api(admin, 'GET', `/office/supply-requests/${octReq.id}`);
	await api(admin, 'POST', `/office/supply-requests/${octReq.id}/finalize`, {
		lines: octFull.lines.map(l => ({ lineId: l.id, finalQty: l.requestedQty })),
	});

	// Kỳ tháng 12 đang mở: Quỳnh đã đăng ký vài dòng để Hạnh thấy "Phòng: N" khi phần của mình là 0.
	const nov = await api(admin, 'POST', '/office/supply-periods', {
		officeSiteId: site.id,
		month: '2026-12',
		deadline: '2026-11-27',
		departmentIds: [hcns.id, kt.id],
	});
	mine = await api(quynh, 'GET', '/me/office/supply-requests');
	const novReq = mine.find(r => r.period.id === nov.id);
	const NL = `/me/office/supply-requests/${novReq.id}/lines`;
	await api(quynh, 'POST', NL, { itemId: items['Bút bi (Note màu xanh)'].id, requestedQty: 5 });
	await api(quynh, 'POST', NL, { itemId: items['Kẹp sắt size nhỏ (19mm)'].id, requestedQty: 2, note: 'Loại có màu' });
	await api(quynh, 'POST', NL, { customName: 'Pin tiểu 3A', customUnit: 'Đôi', requestedQty: 2 });

	fs.writeFileSync(
		ACCOUNTS,
		JSON.stringify(
			{
				api: drill.API,
				people: { admin: company.email, hanh: 'hanh@p1.drill', quynh: 'quynh@p1.drill', tuan: 'tuan@p1.drill' },
				requests: { oct: octReq.id, nov: novReq.id },
				items: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.id])),
			},
			null,
			2,
		),
		{ mode: 0o600 },
	);
	console.log(`SANDBOX READY ${drill.API} — tài khoản ở ${ACCOUNTS}`);

	const stop = async () => {
		await app.stop();
		drill.stopInfra();
		process.exit(0);
	};
	process.on('SIGINT', stop);
	process.on('SIGTERM', stop);
	await new Promise(() => {});
}

main().catch(err => {
	console.error(err);
	drill.stopInfra();
	process.exit(1);
});
