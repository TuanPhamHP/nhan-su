import { describe, expect, it } from 'vitest';
import { moduleOfPath } from '~/composables/useModuleAccess';
import { resolveNotificationRoute } from '~/utils/notification-route';
import { MAX_MENTION_IDS, splitMentionDraft } from '~/utils/recruitment-mention.utils';

/**
 * Trang đích của thông báo tuyển dụng.
 *
 * Vì sao test thay vì chỉ bấm thử: BE đã ghi các đường dẫn này vào `targetUrl` của 18 loại
 * thông báo (`docs/backend/bridges/recruitment.md` mục "Thông báo"). Đổi một chữ trong đường
 * dẫn là thông báo dẫn vào trang 404, mà sandbox không có đủ cả 18 loại để bấm tay từng cái.
 */
describe('resolveNotificationRoute — module tuyển dụng', () => {
	it('nhóm quản lý dẫn vào /management/recruitment/**', () => {
		expect(resolveNotificationRoute('recruitment_requisition', 4, 'HR')).toBe('/management/recruitment/requisitions/4');
		expect(resolveNotificationRoute('recruitment_offer', 9, 'DIRECTOR')).toBe('/management/recruitment/offers/9');
		expect(resolveNotificationRoute('recruitment_job', 12, 'MANAGER')).toBe('/management/recruitment/jobs/12');
		expect(resolveNotificationRoute('recruitment_candidate', 45, 'ADMIN')).toBe('/management/recruitment/candidates/45');
	});

	it('refId của định biên là NĂM nên vào query ?year=, không phải /:id', () => {
		expect(resolveNotificationRoute('recruitment_headcount', 2027, 'DIRECTOR')).toBe(
			'/management/recruitment/headcount?year=2027',
		);
	});

	it('nhóm hội đồng dẫn vào /recruitment/**, kể cả khi người nhận là vai trò quản lý', () => {
		// BE chọn sẵn refType theo từng người nhận, nên FE KHÔNG rẽ theo vai trò ở đây:
		// `recruitment_my_*` luôn là trang tự phục vụ.
		expect(resolveNotificationRoute('recruitment_my_job', 12, 'EMPLOYEE')).toBe('/recruitment/jobs/12');
		expect(resolveNotificationRoute('recruitment_my_job', 12, 'HR')).toBe('/recruitment/jobs/12');
		expect(resolveNotificationRoute('recruitment_my_application', 101, 'EMPLOYEE')).toBe(
			'/recruitment/applications/101',
		);
		expect(resolveNotificationRoute('recruitment_my_interviews', null, 'EMPLOYEE')).toBe('/recruitment/my-interviews');
		expect(resolveNotificationRoute('recruitment_my_interviews', 20, 'MANAGER')).toBe('/recruitment/my-interviews');
	});

	it('N-08 "có nhân viên mới" dẫn vào hồ sơ nhân viên', () => {
		expect(resolveNotificationRoute('employee', 77, 'HR')).toBe('/management/employees/77');
		expect(resolveNotificationRoute('employee', null, 'HR')).toBe('/management/employees');
	});

	it('thiếu refId thì về trang danh sách, không dựng đường dẫn có "undefined"', () => {
		for (const refType of [
			'recruitment_requisition',
			'recruitment_offer',
			'recruitment_job',
			'recruitment_candidate',
			'recruitment_headcount',
			'recruitment_my_job',
			'recruitment_my_application',
		]) {
			const route = resolveNotificationRoute(refType, null, 'HR');
			expect(route).toBeTruthy();
			expect(route).not.toContain('undefined');
			expect(route).not.toContain('null');
		}
	});

	it('refType lạ vẫn trả null để nơi gọi không điều hướng', () => {
		expect(resolveNotificationRoute('recruitment_khong_co_that', 1, 'HR')).toBeNull();
	});
});

/**
 * Tách nội dung ô nhắc tên. Nếu hàm này sai, cú pháp `@[Tên](7)` lọt vào `body` và hiện thô ở
 * trang quản lý của khu tuyển dụng lẫn file Excel xuất ra — những nơi không có bộ dò dấu.
 */
describe('splitMentionDraft', () => {
	it('đổi dấu thành @Tên và tách id ra mentionIds', () => {
		expect(splitMentionDraft('Nhờ @[Phạm Quốc Khánh](5) xem giúp.')).toEqual({
			body: 'Nhờ @Phạm Quốc Khánh xem giúp.',
			mentionIds: [5],
		});
	});

	it('nhiều người, giữ thứ tự xuất hiện', () => {
		expect(splitMentionDraft('@[A](3) và @[B](9) cùng xem')).toEqual({
			body: '@A và @B cùng xem',
			mentionIds: [3, 9],
		});
	});

	it('nhắc một người hai lần chỉ còn một id', () => {
		expect(splitMentionDraft('@[A](3) ơi, @[A](3) xem nhé')).toEqual({
			body: '@A ơi, @A xem nhé',
			mentionIds: [3],
		});
	});

	it('không nhắc ai thì mentionIds rỗng và body giữ nguyên', () => {
		expect(splitMentionDraft('  Ứng viên trả lời tốt.  ')).toEqual({
			body: 'Ứng viên trả lời tốt.',
			mentionIds: [],
		});
	});

	it('cắt còn 20 id vì BE chỉ nhận tối đa 20', () => {
		const raw = Array.from({ length: 25 }, (_, i) => `@[N${i}](${i + 1})`).join(' ');
		const { mentionIds, body } = splitMentionDraft(raw);
		expect(mentionIds).toHaveLength(MAX_MENTION_IDS);
		expect(mentionIds[0]).toBe(1);
		// Người thứ 21 trở đi vẫn còn TÊN trong nội dung, chỉ không được gửi thông báo.
		expect(body).toContain('@N24');
	});

	it('không nuốt chữ trông giống dấu nhưng id không phải số', () => {
		const raw = 'Xem file @[báo cáo](abc) nhé';
		expect(splitMentionDraft(raw)).toEqual({ body: raw, mentionIds: [] });
	});
});

describe('moduleOfPath — RECRUIT', () => {
	it('phủ cả khu quản lý và nhóm trang hội đồng', () => {
		expect(moduleOfPath('/management/recruitment')).toBe('RECRUIT');
		expect(moduleOfPath('/management/recruitment/jobs/12')).toBe('RECRUIT');
		expect(moduleOfPath('/recruitment/my-interviews')).toBe('RECRUIT');
		expect(moduleOfPath('/recruitment/applications/101')).toBe('RECRUIT');
	});

	it('trang công khai KHÔNG thuộc module nào', () => {
		// `/careers/**` và `/offer-response` mở được khi chưa đăng nhập nên không có
		// entitlement để tra; gắn vào RECRUIT thì module-guard sẽ đá ứng viên về /login.
		expect(moduleOfPath('/careers/cty-a')).toBeNull();
		expect(moduleOfPath('/careers/cty-a/backend-developer-nestjs')).toBeNull();
		expect(moduleOfPath('/offer-response')).toBeNull();
	});
});
