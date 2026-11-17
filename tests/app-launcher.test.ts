/**
 * Lưới chọn phân hệ khi công ty chưa mua đủ phân hệ.
 *
 * Phần tính toán nằm trong `splitLauncherApps` nên kiểm được không cần dựng Vue: điều đáng kiểm
 * là ô khoá vẫn còn trong lưới, không lọt vào danh sách phân hệ dùng được, và chỉ hiện cho người
 * mà nếu công ty mua thì vào được.
 */
import { describe, expect, it } from 'vitest';
import { APP_MODULES } from '~/config/app-modules';
import {
	appsWithoutCatalog,
	hotlineTelHref,
	lockBadgeText,
	lockHint,
	lockMessage,
	mergeAppCatalog,
	splitLauncherApps,
} from '~/utils/app-launcher';
import type { AppModuleDef, AppScreensDef, NavItem } from '~/types/navigation.types';
import type { AppTile } from '~/types/entitlement.types';

function item(label: string, route: string, extra: Partial<NavItem> = {}): NavItem {
	return { label, route, icon: 'M0 0', ...extra };
}

/** Bảng màn hình của web: từ 17/11/2026 ở đây không còn chữ nào để hiển thị. */
function screens(code: string, extra: Partial<AppScreensDef> = {}): AppScreensDef {
	return {
		code,
		home: `/${code}`,
		routes: [`/${code}`],
		items: [item('Mục đầu', `/${code}`)],
		...extra,
	};
}

/** Một ô máy chủ trả. */
function tile(code: string, extra: Partial<AppTile> = {}): AppTile {
	return {
		code,
		label: code.toUpperCase(),
		description: `Phân hệ ${code}`,
		group: 'OPERATIONS',
		color: '#8b5cf6',
		icon: 'M0 0',
		module: null,
		locked: false,
		lockReason: null,
		...extra,
	};
}

/** Phân hệ đã ghép, dùng cho các bài kiểm chỉ quan tâm phần chia ô khoá. */
function app(code: string, extra: Partial<AppModuleDef> = {}): AppModuleDef {
	return { ...mergeAppCatalog([screens(code)], [tile(code)])[0]!, ...extra };
}

const SEE_ALL = {
	canSeeItem: () => true,
	canSeeItemIgnoringModule: () => true,
};

describe('splitLauncherApps', () => {
	it('phân hệ chưa đăng ký nằm ở danh sách khoá, không nằm ở danh sách dùng được', () => {
		const defs = [app('rec', { module: 'RECRUIT' }), app('chr')];

		const { visible, locked } = splitLauncherApps(defs, {
			...SEE_ALL,
			moduleLock: code => (code === 'RECRUIT' ? { reason: 'NOT_SUBSCRIBED' } : null),
		});

		expect(visible.map(a => a.code)).toEqual(['chr']);
		expect(locked.map(a => a.code)).toEqual(['rec']);
		expect(locked[0]?.lockReason).toBe('NOT_SUBSCRIBED');
		expect(locked[0]?.lockBadge).toBe('Chưa đăng ký');
		expect(locked[0]?.module).toBe('RECRUIT');
	});

	it('nhãn ngắn trên ô khoá nói đúng lý do', () => {
		for (const [reason, badge] of [
			['SUSPENDED', 'Tạm ngưng'],
			['LAPSED', 'Đã hết hạn'],
		] as const) {
			const { locked } = splitLauncherApps([app('ast', { module: 'ASSET' })], {
				...SEE_ALL,
				moduleLock: () => ({ reason }),
			});
			expect(locked[0]?.lockBadge).toBe(badge);
		}
	});

	it('người không vào được mục nào dù công ty có mua thì không thấy ô khoá', () => {
		const { visible, locked } = splitLauncherApps([app('rec', { module: 'RECRUIT' })], {
			canSeeItem: () => false,
			canSeeItemIgnoringModule: () => false,
			moduleLock: () => ({ reason: 'NOT_SUBSCRIBED' }),
		});

		expect(visible).toEqual([]);
		expect(locked).toEqual([]);
	});

	it('nhân viên chỉ xem được một mục cá nhân vẫn thấy ô khoá, và ô đó chỉ giữ mục họ xem được', () => {
		const defs = [
			app('rec', {
				module: 'RECRUIT',
				items: [
					item('Kho ứng viên', '/management/recruitment/candidates', { management: true }),
					item('Phỏng vấn của tôi', '/recruitment/my-interviews', { scope: 'personal' }),
				],
			}),
		];

		const { locked } = splitLauncherApps(defs, {
			canSeeItem: () => false,
			canSeeItemIgnoringModule: i => i.scope === 'personal',
			moduleLock: () => ({ reason: 'NOT_SUBSCRIBED' }),
		});

		expect(locked).toHaveLength(1);
		expect(locked[0]?.items.map(i => i.label)).toEqual(['Phỏng vấn của tôi']);
	});

	it('phân hệ gộp nhiều module vẫn lọc từng mục như cũ, và mất đi khi không còn mục nào', () => {
		const defs = [
			app('tal', {
				items: [
					item('Làm thêm giờ', '/management/overtime', { module: 'OVERTIME' }),
					item('Chấm công', '/management/attendance'),
				],
			}),
			app('eng', { items: [item('Thông báo', '/announcements', { module: 'ANNOUNCEMENT' })] }),
		];

		const { visible, locked } = splitLauncherApps(defs, {
			canSeeItem: i => i.module !== 'OVERTIME' && i.module !== 'ANNOUNCEMENT',
			canSeeItemIgnoringModule: () => true,
			moduleLock: () => null,
		});

		expect(visible.map(a => a.code)).toEqual(['tal']);
		expect(visible[0]?.items.map(i => i.label)).toEqual(['Chấm công']);
		expect(locked).toEqual([]);
	});

	it('ô dùng được dẫn tới mục đầu tiên người đó xem được khi màn mặc định bị chặn', () => {
		const defs = [
			app('ast', {
				module: 'ASSET',
				home: '/management/assets',
				items: [
					item('Tài sản', '/management/assets', { management: true }),
					item('Tài sản của tôi', '/assets/my', { scope: 'personal' }),
				],
			}),
		];

		const { visible } = splitLauncherApps(defs, {
			canSeeItem: i => i.scope === 'personal',
			canSeeItemIgnoringModule: i => i.scope === 'personal',
			moduleLock: () => null,
		});

		expect(visible[0]?.home).toBe('/assets/my');
	});

	it('phân hệ khoá giữ nguyên nhóm để ô nằm đúng chỗ trong lưới', () => {
		const { locked } = splitLauncherApps([app('rec', { module: 'RECRUIT', group: 'TALENT' })], {
			...SEE_ALL,
			moduleLock: () => ({ reason: 'NOT_SUBSCRIBED' }),
		});

		expect(locked[0]?.group).toBe('TALENT');
	});
});

/**
 * Ghép danh mục máy chủ với bảng màn hình của web.
 *
 * Hai nửa phát hành độc lập nên điều đáng kiểm là lúc chúng lệch nhau: máy chủ thêm phân hệ
 * mà web chưa có màn hình, hoặc web có màn hình mà máy chủ không trả, hoặc không có danh mục.
 */
describe('mergeAppCatalog', () => {
	it('lấy chữ và hình của máy chủ, giữ route và mục menu của web', () => {
		const merged = mergeAppCatalog(
			[screens('rec', { home: '/management/recruitment', routes: ['/management/recruitment', '/recruitment'] })],
			[tile('rec', { label: 'Tuyển dụng', color: '#f59e0b', group: 'TALENT', module: 'RECRUIT' })],
		);

		expect(merged).toHaveLength(1);
		expect(merged[0]).toMatchObject({
			code: 'rec',
			label: 'Tuyển dụng',
			color: '#f59e0b',
			group: 'TALENT',
			module: 'RECRUIT',
			home: '/management/recruitment',
			routes: ['/management/recruitment', '/recruitment'],
		});
		expect(merged[0]?.items).toHaveLength(1);
	});

	it('thứ tự lưới lấy theo máy chủ, không theo thứ tự khai trong web', () => {
		const merged = mergeAppCatalog(
			[screens('chr'), screens('tal'), screens('pay')],
			[tile('pay'), tile('chr'), tile('tal')],
		);

		expect(merged.map(a => a.code)).toEqual(['pay', 'chr', 'tal']);
	});

	it('mã lạ của máy chủ thì bỏ qua, không lỗi', () => {
		const merged = mergeAppCatalog([screens('chr')], [tile('xyz'), tile('chr')]);

		expect(merged.map(a => a.code)).toEqual(['chr']);
	});

	it('web có màn hình mà máy chủ không trả thì không hiện ô', () => {
		const merged = mergeAppCatalog([screens('chr'), screens('sys')], [tile('chr')]);

		expect(merged.map(a => a.code)).toEqual(['chr']);
	});

	it('chưa có danh mục thì vẫn còn route và mục menu để điều hướng, chỉ thiếu chữ và hình', () => {
		const fallback = appsWithoutCatalog([screens('chr', { home: '/management/employees' })]);

		expect(fallback[0]?.home).toBe('/management/employees');
		expect(fallback[0]?.items).toHaveLength(1);
		expect(fallback[0]?.label).toBe('');
		expect(fallback[0]?.icon).toBe('');
		expect(fallback[0]?.module).toBeNull();
	});
});

describe('bảng màn hình của web', () => {
	it('không còn chữ hay hình cấp phân hệ, vì phần đó máy chủ trả', () => {
		// Thêm `label` hay `icon` vào đây là quay lại viết cứng: chỗ cần sửa là app-catalog.ts của BE.
		for (const a of APP_MODULES) {
			expect(Object.keys(a).sort()).toEqual(['code', 'home', 'items', 'routes']);
		}
	});

	it('mọi mục của Tuyển dụng và Quản lý tài sản đều thuộc module bán riêng của phân hệ', () => {
		// Máy chủ khoá cả ô theo `AppTile.module`; mục bên trong cũng phải khai đúng module đó, nếu
		// không thì ô khoá vẫn hiện mục mà người dùng bấm vào sẽ ăn 403.
		for (const [code, module] of [
			['rec', 'RECRUIT'],
			['ast', 'ASSET'],
		] as const) {
			const a = APP_MODULES.find(x => x.code === code);
			expect(a?.items.every(i => i.module === module)).toBe(true);
		}
	});
});

describe('câu chữ của hộp thoại', () => {
	it('câu chính nói đúng chuyện theo từng lý do', () => {
		expect(lockMessage('Tuyển dụng', 'NOT_SUBSCRIBED')).toBe('Công ty bạn chưa đăng ký phân hệ Tuyển dụng.');
		expect(lockMessage('Tuyển dụng', 'SUSPENDED')).toBe('Phân hệ Tuyển dụng đang tạm ngưng với công ty bạn.');
		expect(lockMessage('Tuyển dụng', 'LAPSED')).toBe(
			'Tuyển dụng đã hết hạn dùng nên đang tạm tắt, dữ liệu vẫn được giữ nguyên.',
		);
		expect(lockMessage('Tuyển dụng', null)).toBe('Phân hệ Tuyển dụng chưa được mở cho công ty bạn.');
	});

	it('chưa cấu hình hotline thì giữ câu cũ, không hứa một đầu mối cụ thể', () => {
		expect(lockHint(true, null).text).toBe('Liên hệ nhà cung cấp phần mềm để đăng ký thêm phân hệ này.');
		expect(lockHint(false, null).text).toBe('Bạn liên hệ quản trị viên của công ty nếu cần dùng phân hệ này.');
		for (const hint of [lockHint(true, null), lockHint(false, null)]) {
			expect(hint.phone).toBeNull();
			expect(hint.after).toBe('');
			expect(hint.text).not.toMatch(/\d{9,}|@/);
		}
	});

	it('có hotline thì quản trị viên đọc được số, và số tách riêng để làm liên kết', () => {
		const hint = lockHint(true, '0888888888');
		expect(hint.text).toBe('Liên hệ nhà cung cấp phần mềm qua hotline 0888888888 để đăng ký thêm phân hệ này.');
		expect(hint.phone).toBe('0888888888');
		expect(hint.before + hint.phone + hint.after).toBe(hint.text);
	});

	it('người không phải quản trị viên không bao giờ thấy số, dù máy chủ có trả', () => {
		const hint = lockHint(false, '0888888888');
		expect(hint.phone).toBeNull();
		expect(hint.text).toBe('Bạn liên hệ quản trị viên của công ty nếu cần dùng phân hệ này.');
		expect(hint.text).not.toContain('0888888888');
	});

	it('hotline rỗng, toàn khoảng trắng hay thiếu hẳn đều coi như chưa cấu hình', () => {
		// BE cũ không có trường này nên giá trị tới nơi là `undefined`, không phải `null`.
		for (const raw of [null, undefined, '', '   ']) {
			const hint = lockHint(true, raw);
			expect(hint.phone).toBeNull();
			expect(hint.text).toBe('Liên hệ nhà cung cấp phần mềm để đăng ký thêm phân hệ này.');
		}
	});

	it('liên kết tel bỏ ký tự trình bày nhưng giữ dấu cộng của số quốc tế', () => {
		expect(hotlineTelHref('0888888888')).toBe('tel:0888888888');
		expect(hotlineTelHref('0888 888 888')).toBe('tel:0888888888');
		expect(hotlineTelHref('+84 888.888.888')).toBe('tel:+84888888888');
		// Số hiển thị giữ nguyên cách người vận hành gõ, chỉ `href` mới bị làm sạch.
		expect(lockHint(true, '0888 888 888').phone).toBe('0888 888 888');
	});

	it('nhãn ngắn không bỏ trống khi máy chủ không nói lý do', () => {
		expect(lockBadgeText(null)).toBe('Chưa mở');
		expect(lockBadgeText('READ_ONLY')).toBe('Chưa mở');
	});
});
