import { FEATURE_GUIDES } from '~/config/feature-guides';
import type { FeatureGuide } from '~/types/guide.types';

/** Trang đích không đăng ký tour trong chừng này thì báo lỗi, không để người dùng chờ mãi. */
const PENDING_TIMEOUT_MS = 8000;

/**
 * Hướng dẫn theo tính năng của phân hệ đang mở, đã lọc theo vai trò, quyền và gói module.
 *
 * Lọc bằng đúng `canSeeItem` của menu: hướng dẫn dẫn tới trang người dùng không vào được thì
 * không hiện, nên nhân viên thường không thấy "Mở kỳ văn phòng phẩm".
 */
export function useFeatureGuides() {
	const { currentApp, canSeeItem } = useAppModules();
	const tour = useTour();
	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	let timer: ReturnType<typeof setTimeout> | null = null;

	const guides = computed<FeatureGuide[]>(() => {
		const app = currentApp.value;
		if (!app) return [];
		return FEATURE_GUIDES.filter(
			g => g.app === app.code && canSeeItem({ label: g.title, route: g.to, icon: '', ...g.access }),
		);
	});

	const manageGuides = computed(() => guides.value.filter(g => g.audience === 'manage'));
	const staffGuides = computed(() => guides.value.filter(g => g.audience === 'staff'));

	/** Chạy hướng dẫn: đang đứng đúng trang thì chạy luôn, không thì chuyển trang rồi chạy. */
	async function openGuide(guide: FeatureGuide) {
		const target = router.resolve(guide.to);
		tour.startWhenReady(guide.tourId);
		if (!tour.pending.value) return;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			if (tour.pending.value !== guide.tourId) return;
			tour.cancelPending();
			toast.warning(`Chưa mở được hướng dẫn "${guide.title}". Bạn tải lại trang rồi thử lại.`);
		}, PENDING_TIMEOUT_MS);
		if (route.path !== target.path) await navigateTo(guide.to);
	}

	return { guides, manageGuides, staffGuides, openGuide };
}
