/**
 * F-? (mục ④ của báo cáo): tên file Excel lấy theo `Content-Disposition` của máy chủ.
 *
 * Đợt UAT A, CORS của sandbox chưa mở header này nên trình duyệt không đọc được và trang phải
 * dùng tên dự phòng. Bản BE mới đã thêm `Access-Control-Expose-Headers`, nên bài này kiểm đúng
 * một điều: tên file trong câu "Đã tải file …" là tên của MÁY CHỦ, không phải tên FE tự đặt.
 */
import { WHO, api, apiToken, clearToasts, go, launch, line, shot, signIn, summary, toastText } from './helper.mjs';

const hrToken = await apiToken(WHO.hr.email);

/** Tên file máy chủ đặt cho một endpoint tải về, đọc thẳng bằng fetch. */
async function serverFileName(path) {
	const res = await fetch(`http://localhost:3190${path}`, { headers: { Authorization: `Bearer ${hrToken}` } });
	const header = res.headers.get('content-disposition') ?? '';
	const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
	if (utf8?.[1]) return decodeURIComponent(utf8[1].trim());
	return /filename="?([^";]+)"?/i.exec(header)?.[1]?.trim() ?? '';
}

const periods = (await api(hrToken, '/v1/office/supply-periods')).json?.data ?? [];
const period = periods.sort((a, b) => b.id - a.id)[0];
if (!period) throw new Error('chưa có kỳ nào — chạy smoke-period-open.mjs trước');

const expectedPeriodFile = await serverFileName(`/v1/office/supply-periods/${period.id}/export`);
const expectedReportFile = await serverFileName(`/v1/office/reports/supply-costs/export?monthFrom=${period.month}`);
console.log(`máy chủ đặt tên: "${expectedPeriodFile}" và "${expectedReportFile}"`);
line(!!expectedPeriodFile, 'Máy chủ gửi Content-Disposition cho file tổng hợp', expectedPeriodFile);

const browser = await launch();
const hr = await signIn(browser, WHO.hr.email);

// ─── Bảng tổng hợp kỳ ─────────────────────────────────────────────────────────
await go(hr, `/management/office/supply-periods/${period.id}`, 4500);
await clearToasts(hr);
const periodDownload = hr.waitForEvent('download', { timeout: 30000 });
await hr.getByRole('button', { name: 'Xuất Excel' }).first().click();
const periodFile = await periodDownload;
const periodToast = await toastText(hr, 20000);
line(
	periodFile.suggestedFilename() === expectedPeriodFile,
	'Tên file tổng hợp tải về đúng tên của máy chủ',
	`trình duyệt lưu "${periodFile.suggestedFilename()}", máy chủ đặt "${expectedPeriodFile}"`,
);
line(
	periodToast.includes(expectedPeriodFile),
	'Câu "Đã tải file …" nhắc đúng tên của máy chủ',
	periodToast,
);
console.log('ảnh:', await shot(hr, 'filename-period-export'));

// ─── Báo cáo chi phí ──────────────────────────────────────────────────────────
await go(hr, '/management/office/reports', 4500);
await clearToasts(hr);
const reportDownload = hr.waitForEvent('download', { timeout: 30000 });
await hr.getByRole('button', { name: 'Xuất Excel' }).first().click();
const reportFile = await reportDownload;
const reportToast = await toastText(hr, 20000);
line(
	/\.xlsx$/.test(reportFile.suggestedFilename()) && !/^chi-phi-van-phong-pham-\d{4}-\d{2}\.xlsx$/.test(reportFile.suggestedFilename()),
	'Tên file báo cáo cũng là tên của máy chủ, không phải tên dự phòng của trang',
	`trình duyệt lưu "${reportFile.suggestedFilename()}"`,
);
console.log(`câu toast của báo cáo: ${reportToast}`);
console.log('ảnh:', await shot(hr, 'filename-report-export'));

line(hr.errors.length === 0, 'Không có lỗi JavaScript khi tải file', hr.errors.slice(0, 2).join(' | '));

await browser.close();
process.exit(summary() ? 1 : 0);
