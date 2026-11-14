import { describe, expect, it, vi, afterEach } from 'vitest';
import {
	INCIDENT_BLOCKED_STATUSES,
	assignmentEndText,
	canReportIncident,
	describeAssetEvent,
	maintenanceCreatorName,
	maintenanceDaysLeft,
	maintenanceDueClass,
	maintenanceDueLabel,
} from '~/utils/asset.utils';
import { formatPhotoSize, photoKind, preparePhoto, scaledSize } from '~/utils/image-compress';
import { resolveNotificationRoute } from '~/utils/notification-route';
import { PHYSICAL_STATUSES, type AssetStatus } from '~/types/asset.types';

/**
 * ============================================================
 * Test suite: luật hiện nút và hạn bảo dưỡng của tài sản đợt 2
 * ============================================================
 *
 * Vì sao cần: hai luật dưới đây quyết định người dùng thấy nút gì, và bấm nhầm thì backend
 * trả 409 — một lỗi người dùng không gây ra và cũng không tự sửa được. Bấm thử trên sandbox
 * chỉ phủ được vài trạng thái có sẵn, trong khi enum có tới mười trạng thái, nên bảng ở đây
 * chốt từng ô.
 *
 * Ký hiệu: [EDGE] trường hợp biên
 * ============================================================
 */

describe('canReportIncident', () => {
	it('báo được khi thiết bị đang dùng, sẵn sàng hoặc hỏng', () => {
		expect(canReportIncident('IN_USE', false)).toBe(true);
		expect(canReportIncident('AVAILABLE', false)).toBe(true);
		expect(canReportIncident('BROKEN', false)).toBe(true);
	});

	it('không báo được khi đã có người đang xử lý', () => {
		// Ba trạng thái này đều là "có việc đang chạy": 409 ASSET_INCIDENT_NOT_ALLOWED.
		for (const status of INCIDENT_BLOCKED_STATUSES) {
			expect(canReportIncident(status, false)).toBe(false);
		}
	});

	it('đã có báo cáo cùng loại đang chờ thì ẩn nút của loại đó', () => {
		expect(canReportIncident('IN_USE', true)).toBe(false);
	});

	it('[EDGE] mọi trạng thái còn lại của thiết bị đều không báo được', () => {
		const allowed: AssetStatus[] = ['IN_USE', 'AVAILABLE', 'BROKEN'];
		const rest = PHYSICAL_STATUSES.filter(s => !allowed.includes(s));
		// Mất, đã thanh lý... không còn ai giữ để mà báo.
		for (const status of rest) expect(canReportIncident(status, false)).toBe(false);
	});
});

describe('hạn bảo dưỡng', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	/** Chốt "hôm nay" theo giờ Việt Nam để kết quả không đổi theo máy chạy test. */
	function freezeAt(iso: string) {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(iso));
	}

	it('đếm số ngày còn lại theo lịch', () => {
		freezeAt('2026-11-13T03:00:00+07:00');
		expect(maintenanceDaysLeft('2026-11-23')).toBe(10);
		expect(maintenanceDaysLeft('2026-11-13')).toBe(0);
		expect(maintenanceDaysLeft('2026-11-10')).toBe(-3);
	});

	it('không có lịch thì không có số ngày và không có chữ', () => {
		expect(maintenanceDaysLeft(null)).toBeNull();
		expect(maintenanceDueLabel(null)).toBe('');
	});

	it('chữ nói rõ còn hạn, đến hạn hay quá hạn', () => {
		freezeAt('2026-11-13T03:00:00+07:00');
		expect(maintenanceDueLabel('2026-11-23')).toBe('còn 10 ngày');
		expect(maintenanceDueLabel('2026-11-13')).toBe('đến hạn hôm nay');
		expect(maintenanceDueLabel('2026-11-10')).toBe('quá hạn 3 ngày');
	});

	it('tô đỏ khi quá hạn, hổ phách khi còn 30 ngày trở xuống', () => {
		freezeAt('2026-11-13T03:00:00+07:00');
		expect(maintenanceDueClass('2026-11-10')).toContain('rose');
		expect(maintenanceDueClass('2026-12-13')).toContain('amber');
		expect(maintenanceDueClass('2027-06-13')).not.toContain('amber');
	});

	it('[EDGE] đúng mốc 30 ngày vẫn là sắp đến hạn', () => {
		freezeAt('2026-11-13T03:00:00+07:00');
		expect(maintenanceDaysLeft('2026-12-13')).toBe(30);
		expect(maintenanceDueClass('2026-12-13')).toContain('amber');
		expect(maintenanceDueClass('2026-12-14')).not.toContain('amber');
	});

	it('[EDGE] gần nửa đêm vẫn tính theo ngày lịch Việt Nam', () => {
		// 23:30 giờ Việt Nam ngày 13 — máy chạy ở múi giờ nào cũng phải ra 1 ngày.
		freezeAt('2026-11-13T16:30:00Z');
		expect(maintenanceDaysLeft('2026-11-14')).toBe(1);
	});
});

describe('assignmentEndText (sửa sau bài nhập vai)', () => {
	it('điều chuyển thì gọi tên người nhận mới', () => {
		expect(
			assignmentEndText({
				endReason: 'TRANSFERRED',
				endReasonLabel: 'Điều chuyển',
				transferredTo: { assignmentId: 9, holderName: 'Ngô Thị Hương' },
			}),
		).toBe('Điều chuyển sang Ngô Thị Hương');
	});

	it('mất và thu hồi dùng nhãn của BE', () => {
		expect(assignmentEndText({ endReason: 'LOST', endReasonLabel: 'Mất', transferredTo: null })).toBe('Mất');
		expect(assignmentEndText({ endReason: 'RETURNED', endReasonLabel: 'Thu hồi', transferredTo: null })).toBe('Thu hồi');
	});

	it('[EDGE] dữ liệu điều chuyển trước 14/11 không nối được hai lần thì rơi về nhãn', () => {
		expect(
			assignmentEndText({ endReason: 'TRANSFERRED', endReasonLabel: 'Điều chuyển', transferredTo: null }),
		).toBe('Điều chuyển');
	});
});

describe('Lịch sử tài sản: sự kiện mới và trường mới', () => {
	it('trả lời người nhận báo chưa đúng hiện cả lý do và câu trả lời', () => {
		expect(
			describeAssetEvent('ASSIGNMENT_DISPUTE_RESOLVED', {
				assignmentId: 3,
				reason: 'Không có sạc',
				response: 'Đã gửi bổ sung sạc',
			}),
		).toEqual(['Người nhận báo: Không có sạc', 'Trả lời: Đã gửi bổ sung sạc']);
	});

	it('thu hồi vì điều chuyển nối tên người cũ với người mới', () => {
		const lines = describeAssetEvent('RETURNED', {
			employeeName: 'Trịnh Văn Long',
			endReason: 'TRANSFERRED',
			toName: 'Ngô Thị Hương',
		});
		expect(lines[0]).toBe('Điều chuyển từ Trịnh Văn Long sang Ngô Thị Hương');
	});

	it('đổi đơn vị sửa của phiếu hiện tên đơn vị, không hiện mã', () => {
		expect(
			describeAssetEvent('UPDATED', {
				maintenanceId: 4,
				maintenanceVendor: { from: null, to: 'Điện lạnh Bình Minh' },
			}),
		).toEqual(['Đơn vị sửa chữa của phiếu: để trống → Điện lạnh Bình Minh']);
	});

	it('mã enum trong sự kiện sửa thông tin được dịch sang nhãn', () => {
		expect(describeAssetEvent('UPDATED', { billingCycle: { from: 'MONTHLY', to: 'YEARLY' } })).toEqual([
			'Chu kỳ thanh toán: Hằng tháng → Hằng năm',
		]);
	});
});

describe('Chuẩn bị ảnh báo hỏng', () => {
	it('nhận diện ảnh theo kiểu MIME hoặc đuôi file', () => {
		expect(photoKind({ name: 'a.JPG', type: '' })).toBe('jpeg');
		expect(photoKind({ name: 'a.png', type: 'image/png' })).toBe('png');
		expect(photoKind({ name: 'IMG_1.HEIC', type: '' })).toBe('heic');
		expect(photoKind({ name: 'bien-ban.pdf', type: 'application/pdf' })).toBe('other');
	});

	it('cạnh dài tối đa 2048 px, giữ tỷ lệ', () => {
		expect(scaledSize(4000, 3000)).toEqual({ width: 2048, height: 1536 });
		expect(scaledSize(1200, 800)).toEqual({ width: 1200, height: 800 });
	});

	it('dung lượng ghi kiểu Việt Nam, dấu phẩy thập phân', () => {
		expect(formatPhotoSize(6_907_917)).toBe('6,6 MB');
		expect(formatPhotoSize(820 * 1024)).toBe('820 KB');
	});

	it('[EDGE] tệp không phải ảnh thì không gửi và có câu giải thích', async () => {
		const pdf = new File(['%PDF'], 'bien-ban.pdf', { type: 'application/pdf' });
		const result = await preparePhoto(pdf, 5 * 1024 * 1024);
		expect(result.file).toBeNull();
		expect(result.error).toContain('không phải ảnh');
	});

	it('[EDGE] ảnh nhỏ giữ nguyên, không thu nhỏ', async () => {
		const small = new File([new Uint8Array(1000)], 'nho.jpg', { type: 'image/jpeg' });
		const result = await preparePhoto(small, 5 * 1024 * 1024);
		expect(result.file).toBe(small);
		expect(result.compressed).toBe(false);
	});
});

describe('Định tuyến thông báo tài sản (sửa sau bài nhập vai)', () => {
	it('asset_my_incident mở đúng báo cáo của chính mình', () => {
		expect(resolveNotificationRoute('asset_my_incident', 12, 'EMPLOYEE')).toBe('/assets/my?incident_id=12');
	});

	it('asset_holding cuộn tới thẻ của tài sản', () => {
		expect(resolveNotificationRoute('asset_holding', 7, 'EMPLOYEE')).toBe('/assets/my?asset_id=7');
		expect(resolveNotificationRoute('asset_holding', null, 'EMPLOYEE')).toBe('/assets/my');
	});

	it('người nhận báo chưa đúng mở tab Người dùng, sửa xong mở tab Sửa chữa', () => {
		expect(resolveNotificationRoute('asset', 11, 'HR', 'ASSET_ASSIGNMENT_DISPUTED')).toBe(
			'/management/assets/11?tab=holders',
		);
		expect(resolveNotificationRoute('asset', 3, 'MANAGER', 'ASSET_REPAIR_DONE')).toBe(
			'/management/assets/3?tab=maintenances',
		);
		expect(resolveNotificationRoute('asset', 7, 'MANAGER', 'ASSET_LOST')).toBe('/management/assets/7');
	});
});

describe('maintenanceCreatorName', () => {
	it('phiếu do người mở thì hiện tên người đó', () => {
		expect(maintenanceCreatorName({ name: 'Nhân Sự Một' })).toBe('Nhân Sự Một');
	});

	it('phiếu bảo dưỡng hệ thống tự mở (createdBy null) hiện "Hệ thống"', () => {
		expect(maintenanceCreatorName(null)).toBe('Hệ thống');
	});
});
