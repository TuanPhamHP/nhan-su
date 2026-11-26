// Nạp thêm dữ liệu cho thẻ Văn phòng phẩm của Cài đặt hành chính (P4) vào sandbox đang chạy (sau seed-p3.cjs).
// Không đụng dev 6001.
//
//   - Một nhóm trống, một nhóm đã ngừng dùng (có một mặt hàng), một mặt hàng đã ngừng dùng trong nhóm Bút.
//   - "Tẩy" giá 0 (đã có giá, không phải thiếu giá); một mặt hàng tên rất dài, giá 25 triệu.
//   - File Excel thử ở <thư mục>/p4-import.xlsx: hai mặt hàng mới (một giá không hiểu được), một dòng thiếu đơn vị
//     (bị bỏ qua), một mặt hàng đã có.
//
//   node tests/e2e/supply-catalog/seed-p4.cjs <thư mục để file Excel thử>
const fs = require('fs');
const path = require('path');
const drill = require('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs');
// exceljs chỉ có ở repo BE; mượn để ghi file thử, web không cài thêm gì.
const ExcelJS = require(require.resolve('exceljs', { paths: [drill.ROOT] }));

const ACCOUNTS = '/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json';
const OUT = process.argv[2] ?? '/tmp';

async function api(token, method, url, body) {
	const res = await fetch(`${drill.API}${url}`, {
		method,
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
	const json = await res.json().catch(() => null);
	if (res.status >= 300) throw new Error(`${method} ${url}: ${res.status} ${JSON.stringify(json)}`);
	return json.data;
}

async function main() {
	if (drill.PG_PORT !== 55477) throw new Error('Không phải cổng Postgres của sandbox P1');
	const acc = JSON.parse(fs.readFileSync(ACCOUNTS, 'utf8'));
	const admin = await drill.login(acc.people.admin);

	await api(admin, 'POST', '/office/supply-groups', { name: 'Nhóm thử chưa có mặt hàng' });
	const old = await api(admin, 'POST', '/office/supply-groups', { name: 'Nhóm đã ngừng dùng từ năm ngoái' });
	await api(admin, 'POST', '/office/supply-items', { groupId: old.id, name: 'Mực in kim cũ', unit: 'Hộp' });
	await api(admin, 'PATCH', `/office/supply-groups/${old.id}`, { isActive: false });

	await api(admin, 'PATCH', `/office/supply-items/${acc.items['Bút xoá nước']}`, { isActive: false });
	await api(admin, 'PATCH', `/office/supply-items/${acc.items['Tẩy']}`, { unitPrice: 0 });
	const groups = await api(admin, 'GET', '/office/supply-groups?includeInactive=true');
	const other = groups.find(g => g.name === 'Khác');
	await api(admin, 'POST', '/office/supply-items', {
		groupId: other.id,
		name: 'Máy huỷ tài liệu công suất lớn dùng cho phòng lưu trữ hồ sơ nhân sự, kèm bảo hành ba năm tại chỗ',
		unit: 'Chiếc',
		unitPrice: 25000000,
	});

	const book = new ExcelJS.Workbook();
	const sheet = book.addWorksheet('Văn phòng phẩm');
	sheet.addRow(['Nhóm', 'Tên văn phòng phẩm', 'Đơn vị tính', 'Đơn giá (gồm VAT)', 'Chỉ HCNS đặt']);
	sheet.addRow(['Nhóm nhập từ file thử', 'Sổ tay nhập thử A', 'Cuốn', '15.000', 'Không']);
	sheet.addRow(['Nhóm nhập từ file thử', 'Sổ tay nhập thử B', 'Cuốn', 'khoảng mười nghìn', 'Không']);
	sheet.addRow(['Nhóm nhập từ file thử', 'Sổ tay thiếu đơn vị', '', '5000', 'Không']);
	sheet.addRow(['Bút (Note màu) & các loại gim', 'Bút chì gỗ', 'Chiếc', '3000', 'Không']);
	const file = path.join(OUT, 'p4-import.xlsx');
	await book.xlsx.writeFile(file);

	console.log(`seed-p4 xong; file thử ${file}`);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
