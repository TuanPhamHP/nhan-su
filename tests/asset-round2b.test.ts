import { describe, expect, it } from 'vitest';
import { APP_MODULES } from '~/config/app-modules';
import {
	canProposeDisposal,
	canViewStocktakes,
	defaultStatusLabel,
	describeAssetEvent,
	disposalChangesText,
	disposalCountText,
	disposalItemsSummary,
	disposalTotalItems,
	hiddenItemsText,
	disposalItemErrors,
	disposalResubmitText,
	disposalStopDateText,
	suggestedResolution,
	formatVndInput,
	labelsFileName,
	parseVndInput,
	scanResultText,
	STOCKTAKE_ONE_OPEN_HINT,
} from '~/utils/asset.utils';
import { resolveNotificationRoute } from '~/utils/notification-route';
import {
	ASSET_DISPOSAL_METHOD_LABELS,
	ASSET_STOCKTAKE_RESOLUTION_LABELS,
	PHYSICAL_STATUSES,
	type AssetStatus,
} from '~/types/asset.types';

/**
 * ============================================================
 * Test suite: tài sản lô 2b (thanh lý, tem, kiểm kê) phía web
 * ============================================================
 *
 * Vì sao cần: nút "Đề nghị thanh lý" hiện theo luật của bridge doc, đánh dấu dòng lỗi đọc từ
 * `error.errors` của 409, và lịch sử tài sản dịch payload mới sang câu tiếng Việt. Ba chỗ này
 * sai thì người dùng thấy nút bấm vào chỉ nhận 409, hoặc đọc mã kỹ thuật trong lịch sử.
 *
 * Ký hiệu: [EDGE] trường hợp biên
 * ============================================================
 */

const device = (status: AssetStatus, extra: Partial<Parameters<typeof canProposeDisposal>[0]> = {}) => ({
	kind: 'PHYSICAL' as const,
	status,
	holders: [],
	pendingDisposalId: null,
	...extra,
});

describe('canProposeDisposal', () => {
	it('thiết bị Sẵn sàng, Hỏng, Mất không ai giữ thì đề nghị được', () => {
		for (const s of ['AVAILABLE', 'BROKEN', 'LOST'] as AssetStatus[]) expect(canProposeDisposal(device(s))).toBe(true);
	});

	it('đã nằm trong phiếu chờ duyệt thì ẩn nút', () => {
		expect(canProposeDisposal(device('BROKEN', { pendingDisposalId: 4 }))).toBe(false);
	});

	it('[EDGE] còn người giữ thì ẩn nút dù trạng thái hợp lệ', () => {
		const holder = {
			assignmentId: 1,
			employee: { id: 1, fullName: 'A', employeeCode: 'A1' },
			department: null,
			responsible: null,
			assignedAt: '2026-01-01',
			confirmation: 'CONFIRMED' as const,
			confirmationLabel: 'Đã nhận',
		};
		expect(canProposeDisposal(device('AVAILABLE', { holders: [holder] }))).toBe(false);
	});

	it('[EDGE] các trạng thái còn lại và dịch vụ đều không đề nghị được', () => {
		const rest = PHYSICAL_STATUSES.filter(s => !['AVAILABLE', 'BROKEN', 'LOST'].includes(s));
		for (const s of rest) expect(canProposeDisposal(device(s))).toBe(false);
		expect(canProposeDisposal({ ...device('AVAILABLE'), kind: 'SERVICE' })).toBe(false);
	});
});

describe('disposalItemErrors', () => {
	it('đọc danh sách tài sản lỗi của 409 ASSET_DISPOSAL_NOT_ALLOWED', () => {
		const e = Object.assign(new Error('Có 1 tài sản không thanh lý được.'), {
			data: { error: { code: 'ASSET_DISPOSAL_NOT_ALLOWED', errors: [{ assetId: 10, code: 'ASSIGNED', reason: 'Đang cấp phát' }] } },
		});
		expect(disposalItemErrors(e)).toEqual([{ assetId: 10, code: 'ASSIGNED', reason: 'Đang cấp phát' }]);
	});

	it('[EDGE] lỗi khác hoặc mất mạng thì trả mảng rỗng', () => {
		expect(disposalItemErrors(new Error('mạng'))).toEqual([]);
		expect(disposalItemErrors(null)).toEqual([]);
	});
});

describe('ô giá thu về', () => {
	it('hiện số theo kiểu Việt Nam và đọc ngược lại được', () => {
		expect(formatVndInput(1500000)).toBe('1.500.000');
		expect(parseVndInput('1.500.000')).toBe(1500000);
	});

	it('[EDGE] chữ cái bị bỏ, ô trống là không gửi', () => {
		expect(parseVndInput('1a5b0')).toBe(150);
		expect(parseVndInput('')).toBeUndefined();
		expect(formatVndInput(undefined)).toBe('');
	});
});

describe('Lịch sử tài sản: sự kiện lô 2b', () => {
	it('gửi lại phiếu thanh lý nói rõ vòng và hình thức', () => {
		expect(
			describeAssetEvent('DISPOSAL_REQUESTED', {
				disposalId: 7,
				round: 2,
				method: 'DESTROY',
				disposalDate: '2026-11-14',
				reason: 'Hỏng bo mạch',
				resubmitted: true,
			}),
		).toEqual(['Sửa và gửi lại phiếu thanh lý số 7, lần 2', 'Hình thức: Tiêu huỷ', 'Ngày thanh lý: 14/11/2026', 'Lý do: Hỏng bo mạch']);
	});

	it('gửi lần đầu không nói tới lần gửi, không có chữ "vòng"', () => {
		const lines = describeAssetEvent('DISPOSAL_REQUESTED', { disposalId: 5, round: 1, method: 'SALE' });
		expect(lines[0]).toBe('Gửi phiếu thanh lý số 5');
		expect(lines.join(' ')).not.toMatch(/vòng/i);
	});

	it('thanh lý xong ghi trạng thái cũ, ngày dừng khấu hao bằng nhãn tiếng Việt', () => {
		const lines = describeAssetEvent('DISPOSED', {
			disposalId: 7,
			method: 'SALE',
			from: 'BROKEN',
			to: 'DISPOSED',
			disposalDate: '2026-11-14',
			depreciationStopDate: '2026-11-14',
		});
		expect(lines).toContain('Từ "Hỏng" sang "Đã thanh lý"');
		expect(lines).toContain('Dừng khấu hao từ 14/11/2026');
		expect(lines.join(' ')).not.toMatch(/BROKEN|DISPOSED|SALE/);
	});

	it('xử lý chênh lệch kiểm kê hiện cách xử lý và vị trí đổi', () => {
		const lines = describeAssetEvent('STOCKTAKE_RESOLVED', {
			stocktakeName: 'Kiểm kê quý 4',
			result: 'WRONG_LOCATION',
			resolution: 'UPDATED',
			location: { from: 'Kho A', to: 'Kho B' },
		});
		expect(lines).toEqual(['Đợt "Kiểm kê quý 4", kết quả Sai vị trí', 'Cách xử lý: Đã cập nhật sổ', 'Vị trí: từ "Kho A" sang "Kho B"']);
		expect(lines.join(' ')).not.toContain('→');
	});

	it('[EDGE] sổ chưa ghi vị trí thì nói là ghi mới, không ghi "từ để trống"', () => {
		const lines = describeAssetEvent('STOCKTAKE_RESOLVED', { resolution: 'UPDATED', location: { from: null, to: 'Kho B' } });
		expect(lines).toContain('Vị trí: ghi mới "Kho B"');
	});

	it('quét tem ghi "quét tem", không còn "bắn mã"', () => {
		const lines = describeAssetEvent('STOCKTAKE_CHECKED', { stocktakeName: 'Q4', result: 'OK', byScan: true });
		expect(lines).toContain('Ghi bằng cách quét tem');
	});
});

describe('Câu chữ sửa sau bài nhập vai', () => {
	it('chỉ hiện "Gửi lại lần n" khi đã gửi lại', () => {
		expect(disposalResubmitText(1)).toBe('');
		expect(disposalResubmitText(2)).toBe('Gửi lại lần 2');
	});

	it('tên file tem có ngày giờ để hai lần in không trùng tên', () => {
		expect(labelsFileName(new Date(2026, 10, 15, 9, 5))).toBe('tem-tai-san-20261115-0905.pdf');
	});

	it('câu quét tem nêu serial và người giữ theo sổ', () => {
		expect(
			scanResultText({
				inScope: true,
				resultLabel: 'Đúng',
				expectedHolderName: 'Bùi Thị Mai',
				expectedDepartmentName: 'Kho vận',
				asset: { code: 'CTA000003', name: 'Máy quét mã vạch Zebra TC21', serialNumber: 'ZB-TC21-0001' },
			}),
		).toBe('Đã ghi Đúng cho CTA000003 · Máy quét mã vạch Zebra TC21 (serial ZB-TC21-0001), Bùi Thị Mai đang giữ.');
	});

	it('[EDGE] cấp cho phòng ban thì nói "đang giao cho", chưa ai giữ thì nói rõ', () => {
		const base = { inScope: true, resultLabel: 'Đúng', asset: { code: 'CTA000002', name: 'Xe bán tải', serialNumber: null } };
		expect(
			scanResultText({ ...base, expectedHolderName: 'Điều phối vận tải, Lê Văn Dũng chịu trách nhiệm', expectedDepartmentName: 'Điều phối vận tải' }),
		).toBe('Đã ghi Đúng cho CTA000002 · Xe bán tải, theo sổ đang giao cho Điều phối vận tải, Lê Văn Dũng chịu trách nhiệm.');
		expect(scanResultText({ ...base, expectedHolderName: null, expectedDepartmentName: null })).toBe(
			'Đã ghi Đúng cho CTA000002 · Xe bán tải, theo sổ chưa cấp phát cho ai.',
		);
	});

	it('[EDGE] dòng ngoài phạm vi chỉ ghi tham khảo', () => {
		expect(
			scanResultText({
				inScope: false,
				resultLabel: 'Đúng',
				expectedHolderName: 'Trịnh Văn Long',
				expectedDepartmentName: 'Kinh doanh',
				asset: { code: 'CTA000010', name: 'Laptop Dell Latitude 3440', serialNumber: 'DL-3440-0101' },
			}),
		).toBe('CTA000010 · Laptop Dell Latitude 3440 (serial DL-3440-0101) nằm ngoài phạm vi đợt này, chỉ ghi tham khảo và không đổi gì trên sổ.');
	});

	it('nhãn bản sao khớp nhãn BE mới', () => {
		expect(ASSET_DISPOSAL_METHOD_LABELS.DESTROY).toBe('Tiêu huỷ');
		expect(ASSET_STOCKTAKE_RESOLUTION_LABELS.REPAIR_OPENED).toBe('Đã tạo phiếu sửa');
		expect(ASSET_STOCKTAKE_RESOLUTION_LABELS.MARKED_LOST).toBe('Đã xác nhận mất');
		expect(ASSET_STOCKTAKE_RESOLUTION_LABELS.IGNORED).toBe('Giữ nguyên sổ');
		expect(ASSET_STOCKTAKE_RESOLUTION_LABELS.UPDATED).toBe('Đã cập nhật sổ');
	});
});

describe('Vòng 3 sau UAT của kế toán và tổng giám đốc', () => {
	it('(1) dòng Không tìm thấy không chọn sẵn cách xử lý nào', () => {
		expect(suggestedResolution('NOT_FOUND')).toBeUndefined();
		expect(suggestedResolution('DAMAGED')).toBe('REPAIR_OPENED');
		expect(suggestedResolution('WRONG_LOCATION')).toBe('UPDATED');
	});

	it('(8) dòng gửi lại hiện nguyên văn câu "đã đổi gì" của BE, không thêm tiền tố', () => {
		expect(disposalChangesText('Bỏ CTA000011 khỏi phiếu. Sửa lý do.')).toBe('Bỏ CTA000011 khỏi phiếu. Sửa lý do.');
		expect(disposalChangesText('Gửi lại, không đổi nội dung phiếu.')).toBe('Gửi lại, không đổi nội dung phiếu.');
		expect(disposalChangesText(null)).toBe('');
	});

	it('(9) mọi thiết bị cùng ngày thì nêu ngày đó, kể cả phiếu chỉ có thiết bị Mất', () => {
		expect(
			disposalStopDateText({ disposalDate: '2026-11-15', items: [{ code: 'CTA000014', depreciationStopDate: '2026-10-26' }] }),
		).toBe('dừng khấu hao từ ngày 26/10/2026');
	});

	it('(9) [EDGE] khác ngày thì nêu ngày thanh lý và kể riêng thiết bị đã Mất', () => {
		expect(
			disposalStopDateText({
				disposalDate: '2026-11-15',
				items: [
					{ code: 'CTA000011', depreciationStopDate: '2026-11-15' },
					{ code: 'CTA000014', depreciationStopDate: '2026-10-26' },
				],
			}),
		).toBe(
			'dừng khấu hao từ ngày 15/11/2026, riêng thiết bị đã Mất giữ ngày ghi nhận mất (CTA000014 từ ngày 26/10/2026)',
		);
	});

	it('(11) không gõ từ khoá thì nhãn mặc định nói rõ trừ Đã thanh lý; có từ khoá thì tất cả', () => {
		expect(defaultStatusLabel('', '')).toBe('Tất cả, trừ Đã thanh lý');
		expect(defaultStatusLabel('', 'Latitude')).toBe('Tất cả trạng thái');
		expect(defaultStatusLabel('SERVICE', '')).toBe('Tất cả trạng thái');
	});

	it('(12) CHIEF, DIRECTOR có asset:read xem được kiểm kê; MANAGER thì không', () => {
		const perms = (list: string[]) => (code: string) => list.includes(code);
		expect(canViewStocktakes('CHIEF', perms(['asset:read']))).toBe(true);
		expect(canViewStocktakes('DIRECTOR', perms(['asset:read']))).toBe(true);
		expect(canViewStocktakes('MANAGER', perms(['asset:read']))).toBe(false);
		// [EDGE] có asset:manage thì vai trò nào cũng xem được; thiếu asset:read thì lãnh đạo cũng không.
		expect(canViewStocktakes('MANAGER', perms(['asset:manage']))).toBe(true);
		expect(canViewStocktakes('CHIEF', perms([]))).toBe(false);
	});

	it('(12) mục Kiểm kê ở menu mở thêm lối chỉ xem cho lãnh đạo có asset:read', () => {
		const item = APP_MODULES.flatMap(a => a.items).find(i => i.route === '/management/assets/stocktakes');
		expect(item?.permission).toBe('asset:manage');
		expect(item?.alsoFor).toEqual({ roles: ['ADMIN', 'HR', 'DIRECTOR', 'CHIEF'], permission: 'asset:read' });
	});

	it('(13) giấy tờ đính vào phiếu thanh lý nói rõ số phiếu', () => {
		expect(describeAssetEvent('DOCUMENT_ADDED', { fileName: 'bb.pdf', disposalId: 2 })).toEqual([
			'Thêm giấy tờ vào phiếu thanh lý số 2: bb.pdf',
		]);
		expect(describeAssetEvent('DOCUMENT_ADDED', { fileName: 'hoa-don.pdf' })).toEqual(['Thêm giấy tờ: hoa-don.pdf']);
		expect(describeAssetEvent('DOCUMENT_REMOVED', { fileName: 'hoa-don.pdf' })).toEqual(['Gỡ giấy tờ: hoa-don.pdf']);
	});
});

describe('Định tuyến thông báo thanh lý', () => {
	it('asset_disposal mở trang phiếu, không rẽ theo vai trò', () => {
		expect(resolveNotificationRoute('asset_disposal', 12, 'DIRECTOR', 'ASSET_DISPOSAL_PENDING')).toBe(
			'/management/assets/disposals/12',
		);
		expect(resolveNotificationRoute('asset_disposal', 12, 'HR', 'ASSET_DISPOSAL_DECIDED')).toBe(
			'/management/assets/disposals/12',
		);
	});
});

describe('Tooltip L13', () => {
	it('chép nguyên văn câu của thiết kế', () => {
		expect(STOCKTAKE_ONE_OPEN_HINT).toBe(
			'Mỗi lúc chỉ mở được một đợt kiểm kê, để mỗi lần quét luôn ghi vào đúng một đợt. Muốn mở đợt mới, bạn đóng hoặc huỷ đợt đang mở.',
		);
	});
});

describe('16/11/2026: trưởng phòng chỉ thấy thiết bị của phòng mình trên phiếu thanh lý', () => {
	const managerView = { items: [{ name: 'Xe bán tải Ford Ranger XLS' }], hiddenItemCount: 2 };
	const fullView = { items: [{ name: 'Xe bán tải Ford Ranger XLS' }, { name: 'Điện thoại Samsung Galaxy A15' }, { name: 'Máy quét cũ' }], hiddenItemCount: 0 };

	it('tổng số thiết bị tính cả phần bị ẩn', () => {
		expect(disposalTotalItems(managerView)).toBe(3);
		expect(disposalTotalItems(fullView)).toBe(3);
	});

	it('danh sách ghi rõ số của phòng mình để không hiểu nhầm phiếu chỉ có một máy', () => {
		expect(disposalCountText(managerView)).toBe('3 thiết bị, 1 của phòng bạn');
		expect(disposalCountText(fullView)).toBe('3 thiết bị');
	});

	it('tóm tắt tên thiết bị đếm cả thiết bị ẩn vào phần "khác"', () => {
		expect(disposalItemsSummary(managerView)).toBe('Xe bán tải Ford Ranger XLS và 2 thiết bị khác');
		expect(disposalItemsSummary(fullView)).toBe('Xe bán tải Ford Ranger XLS, Điện thoại Samsung Galaxy A15 và 1 thiết bị khác');
	});

	it('dòng dưới bảng chỉ có khi có thiết bị ẩn', () => {
		expect(hiddenItemsText(2)).toBe('và 2 thiết bị không thuộc phòng bạn');
		expect(hiddenItemsText(0)).toBe('');
	});

	it('[EDGE] không thấy thiết bị nào thì vẫn nói số thiết bị ẩn', () => {
		expect(disposalItemsSummary({ items: [], hiddenItemCount: 2 })).toBe('2 thiết bị không thuộc phòng bạn');
	});
});
