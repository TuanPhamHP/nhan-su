/**
 * Chụp ba trang đại diện ngoài module Hành chính văn phòng, trước và sau khi đổi tiêu đề trang
 * sang `UiPageHeader` (mô tả nằm sau dấu hỏi).
 *
 *   node tests/e2e/office-lot1/shots-page-header.mjs truoc
 *   node tests/e2e/office-lot1/shots-page-header.mjs sau
 */
import { WHO, go, launch, shot, signIn } from './helper.mjs';

const phase = process.argv[2] === 'sau' ? 'sau' : 'truoc';

/**
 * Ba trang đại diện ba nhóm nghiệp vụ khác nhau, và cả ba đều có mô tả thuần chữ.
 *
 * Không lấy trang của module Tài sản vì công ty trên sandbox chưa được cấp module đó, mở ra chỉ
 * thấy trang Tổng quan.
 */
const PAGES = [
	{ path: '/management/leave', name: 'nghi-phep' },
	{ path: '/management/attendance', name: 'cham-cong' },
	{ path: '/management/violations', name: 'vi-pham' },
];

const browser = await launch();
const page = await signIn(browser, WHO.hr.email);

for (const target of PAGES) {
	await go(page, target.path, 4500);
	console.log('ảnh:', await shot(page, `page-header-${phase}-${target.name}`));
}

await browser.close();
