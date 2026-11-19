/**
 * FE-06 riêng một bài, vì nó chỉ mở một đường dẫn nên chạy lại bao nhiêu lần cũng được.
 *
 * `smoke-supplies.mjs` nhập dòng vào phiếu nên chạy một lần là xong; bài này tách ra để kiểm lại
 * nhanh đường "mở phiếu của phòng khác" mà không phải dựng lại dữ liệu.
 */
import { WHO, api, apiToken, go, launch, line, shot, signIn, summary, text, toastText } from './helper.mjs';

const hrToken = await apiToken(WHO.hr.email);
const periods = await api(hrToken, '/v1/office/supply-periods');
const periodId = periods.json?.data?.[0]?.id;
const summaryRes = await api(hrToken, `/v1/office/supply-periods/${periodId}`);
const deptA = summaryRes.json?.data?.departments?.find(d => d.departmentId === WHO.employeeA1.departmentId);
const requestA = deptA?.requests?.[0]?.id;
line(!!requestA, 'FE-06 đọc được id phiếu phòng A để dựng link', `request ${requestA}`);

const browser = await launch();
const b1 = await signIn(browser, WHO.employeeB1.email);
await go(b1, `/office/supplies?request_id=${requestA}`);
await b1.waitForTimeout(3000);

const toast = await toastText(b1, 8000);
const body = await text(b1);
line(/phòng khác|phòng mình|phòng bạn/i.test(toast), 'FE-06 báo rõ phiếu không phải của phòng mình', toast);
line(body.includes('Văn phòng phẩm của phòng'), 'FE-06 không trắng trang', body.slice(0, 120));
line(b1.url().endsWith('/office/supplies'), 'FE-06 query request_id đã được dọn khỏi URL', b1.url());
line(b1.errors.length === 0, 'FE-06 không có lỗi JavaScript trên console', b1.errors.slice(0, 2).join(' | '));
console.log('ảnh:', await shot(b1, 'fe-06-other-department'));

await browser.close();
process.exit(summary() ? 1 : 0);
