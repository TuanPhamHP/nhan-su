import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import type { Ref } from 'vue';
import type { PeriodCreatePreset } from '~/composables/useSupplyPeriods';
import {
	addDaysYmd,
	addMonthsYm,
	daysBetweenYmd,
	defaultPeriodDeadline,
	defaultPeriodMonth,
	findPeriodFor,
	latestPeriod,
	latestPeriodOf,
	lockAtOfDeadline,
	monthLabel,
	officeErrorCode,
	officeErrorMessage,
	supplyLockLabel,
	vnDateYmd,
	vnMonthValue,
	weekdayOf,
} from '~/utils/office.utils';
import type { CreateSupplyPeriodBody, OfficeSite, SupplyPeriod } from '~/types/office.types';

/** Tiêu đề kỳ dài tối đa chừng này ký tự, theo `CreateSupplyPeriodDto` của máy chủ. */
export const PERIOD_TITLE_MAX = 100;

/** Thứ tự các ô, để bấm Mở kỳ khi còn thiếu thì con trỏ nhảy tới ô thiếu đầu tiên. */
export const PERIOD_FIELD_IDS = {
	officeSiteId: 'period-site',
	month: 'period-month',
	deadline: 'period-deadline',
	title: 'period-title',
	departmentIds: 'period-departments',
} as const;

type PeriodField = keyof typeof PERIOD_FIELD_IDS;

const PERIOD_FIELD_ORDER: PeriodField[] = ['officeSiteId', 'month', 'deadline', 'title', 'departmentIds'];

interface PeriodCreateOptions {
	sites: Ref<OfficeSite[]>;
	/** Mọi kỳ người xem thấy, không lọc, để tính mặc định và chặn trùng. */
	periods: Ref<SupplyPeriod[]>;
	preset: Ref<PeriodCreatePreset | null | undefined>;
	submit: (body: CreateSupplyPeriodBody) => Promise<SupplyPeriod>;
}

/**
 * Form "Mở kỳ đăng ký văn phòng phẩm".
 *
 * Mở kỳ tháng sau chỉ cần xác nhận: văn phòng, tháng, hạn chót và phòng tham gia đều điền sẵn theo
 * kỳ gần nhất. Đổi văn phòng hay tháng thì các giá trị điền sẵn tính lại, trừ ô người dùng đã tự sửa.
 */
export function usePeriodCreateForm(options: PeriodCreateOptions) {
	const { sites, periods, preset } = options;
	const directoryStore = useDirectoryStore();
	const { departments } = storeToRefs(directoryStore);

	const today = vnDateYmd(new Date());
	const nowMonth = vnMonthValue();

	const schema = toTypedSchema(
		z.object({
			officeSiteId: z.number({ message: 'Bạn chọn văn phòng.' }),
			month: z.string({ message: 'Bạn chọn tháng chi phí.' }).regex(/^\d{4}-\d{2}$/, 'Bạn chọn tháng chi phí.'),
			deadline: z.string({ message: 'Bạn chọn hạn chót đăng ký.' }).min(1, 'Bạn chọn hạn chót đăng ký.'),
			title: z.string().trim().max(PERIOD_TITLE_MAX, `Tiêu đề dài tối đa ${PERIOD_TITLE_MAX} ký tự.`).optional(),
			departmentIds: z.array(z.number()).min(1, 'Bạn chọn ít nhất một phòng tham gia.'),
		}),
	);

	const { handleSubmit, errors, isSubmitting, setFieldError, defineField } = useForm({
		validationSchema: schema,
		initialValues: { title: '', departmentIds: [] as number[] },
	});

	const [officeSiteId] = defineField('officeSiteId');
	const [month] = defineField('month');
	const [deadline] = defineField('deadline');
	const [title] = defineField('title');
	const [departmentIds] = defineField('departmentIds');

	/** Người dùng đã tự chọn hạn chót, hay tự tick phòng: đổi văn phòng, tháng thì không ghi đè. */
	const deadlineTouched = ref(false);
	const departmentsTouched = ref(false);
	/** Hạn chót đang là giá trị điền sẵn theo kỳ trước, để nói ra cho người dùng biết. */
	const deadlineFromPrevious = ref(false);
	const formError = ref('');

	const latestForSite = computed(() =>
		officeSiteId.value ? latestPeriodOf(periods.value, officeSiteId.value) : null,
	);

	// ─── Phòng tham gia ───────────────────────────────────────────────────────

	const loadingDepartments = ref(true);
	const departmentsError = ref('');
	const activeDepartments = computed(() => departments.value.filter(d => d.isActive));

	/** Phòng của kỳ gần nhất cùng văn phòng (còn hoạt động); không có kỳ nào thì mọi phòng. */
	function applyDefaultDepartments() {
		if (departmentsTouched.value) return;
		const active = new Set(activeDepartments.value.map(d => d.id));
		const previous = (latestForSite.value?.departmentIds ?? []).filter(id => active.has(id));
		departmentIds.value = previous.length ? previous : [...active];
	}

	async function loadDepartments() {
		loadingDepartments.value = true;
		departmentsError.value = '';
		try {
			await directoryStore.load();
			applyDefaultDepartments();
		} catch (e) {
			departmentsError.value = officeErrorMessage(e, 'Chưa tải được danh sách phòng ban.');
		} finally {
			loadingDepartments.value = false;
		}
	}

	function setDepartments(ids: number[]) {
		departmentsTouched.value = true;
		departmentIds.value = ids;
	}

	function toggleDepartment(id: number) {
		const ids = departmentIds.value ?? [];
		setDepartments(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
	}

	const selectedCount = computed(() => departmentIds.value?.length ?? 0);
	const allSelected = computed(
		() => activeDepartments.value.length > 0 && selectedCount.value === activeDepartments.value.length,
	);
	const excludedNames = computed(() => {
		const chosen = new Set(departmentIds.value ?? []);
		return activeDepartments.value.filter(d => !chosen.has(d.id)).map(d => d.name);
	});

	// ─── Văn phòng, tháng, hạn chót ───────────────────────────────────────────

	/** Văn phòng chọn sẵn: văn phòng duy nhất, hoặc văn phòng của kỳ gần nhất, hoặc văn phòng đầu tiên. */
	function initialSite(): number | undefined {
		if (preset.value) return preset.value.siteId;
		if (sites.value.length === 1) return sites.value[0]?.id;
		const latest = latestPeriod(periods.value);
		if (latest && sites.value.some(s => s.id === latest.officeSite.id)) return latest.officeSite.id;
		return sites.value[0]?.id;
	}

	function applyDefaultDeadline() {
		if (deadlineTouched.value || !month.value) return;
		const value = defaultPeriodDeadline(latestForSite.value, month.value, today);
		deadline.value = value;
		deadlineFromPrevious.value = !!value;
	}

	function applySite(siteId: number | undefined, presetMonth?: string) {
		officeSiteId.value = siteId;
		month.value = presetMonth ?? defaultPeriodMonth(latestForSite.value, nowMonth);
		applyDefaultDeadline();
		applyDefaultDepartments();
	}

	function setSite(value: string | number | undefined) {
		const id = Number(value);
		applySite(Number.isInteger(id) && id > 0 ? id : undefined);
	}

	function setMonth(value: string | number | undefined) {
		month.value = String(value ?? '');
		applyDefaultDeadline();
	}

	function setDeadline(value: string | undefined) {
		deadline.value = value ?? '';
		deadlineTouched.value = true;
		deadlineFromPrevious.value = false;
	}

	/** Từ tháng này tới một năm tới; máy chủ không cho mở kỳ của tháng đã qua. */
	const monthOptions = computed(() =>
		Array.from({ length: 13 }, (_, offset) => {
			const value = addMonthsYm(nowMonth, offset);
			const taken = officeSiteId.value ? findPeriodFor(periods.value, officeSiteId.value, value) : null;
			return { value, label: taken ? `${monthLabel(value)} · đã có kỳ` : monthLabel(value) };
		}),
	);

	const duplicate = computed(() =>
		officeSiteId.value && month.value ? findPeriodFor(periods.value, officeSiteId.value, month.value) : null,
	);

	const siteName = computed(() => sites.value.find(s => s.id === officeSiteId.value)?.name ?? '');

	/** "Chủ nhật", có cảnh báo nhẹ nếu rơi vào cuối tuần. */
	const deadlineWeekday = computed(() => (deadline.value ? weekdayOf(deadline.value) : null));

	/** "Phiếu tự khoá lúc 00:00 ngày 28/12/2026 · còn 34 ngày", đổi ngay khi sửa hạn chót. */
	const lockLine = computed(() => {
		if (!deadline.value) return '';
		const lockDay = addDaysYmd(deadline.value, 1);
		const days = daysBetweenYmd(today, lockDay);
		const left = days > 0 ? ` · còn ${days} ngày` : '';
		return `Phiếu tự khoá lúc ${supplyLockLabel(lockAtOfDeadline(deadline.value))}${left}`;
	});

	const autoTitle = computed(() => (month.value ? monthLabel(month.value) : ''));

	// ─── Gửi ──────────────────────────────────────────────────────────────────

	function focusField(field: PeriodField) {
		const el = document.getElementById(PERIOD_FIELD_IDS[field]);
		el?.focus();
		el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	}

	/** Ô thiếu đầu tiên theo thứ tự trên form, để nút Mở kỳ không bao giờ im lặng. */
	function firstErrorField(fieldErrors: Partial<Record<string, string | undefined>>): PeriodField | null {
		return PERIOD_FIELD_ORDER.find(field => !!fieldErrors[field]) ?? null;
	}

	/** Lỗi của máy chủ đặt vào đúng ô; trả ô có lỗi để mở rộng phần tương ứng nếu cần. */
	function applyServerError(e: unknown): PeriodField | null {
		const message = (fallback: string) => officeErrorMessage(e, fallback);
		switch (officeErrorCode(e)) {
			case 'OFFICE_SUPPLY_DEADLINE_PAST':
			case 'OFFICE_SUPPLY_DEADLINE_INVALID':
				setFieldError('deadline', message('Hạn chót phải là ngày từ hôm nay trở đi.'));
				return 'deadline';
			case 'OFFICE_SUPPLY_PERIOD_MONTH_PAST':
				setFieldError('month', message('Tháng này đã qua. Bạn chọn tháng hiện tại hoặc tháng sau.'));
				return 'month';
			case 'OFFICE_SUPPLY_PERIOD_EXISTS':
				setFieldError('month', message('Văn phòng này đã có kỳ của tháng đã chọn.'));
				return 'month';
			case 'OFFICE_SITE_INACTIVE':
			case 'OFFICE_SITE_NOT_FOUND':
				setFieldError('officeSiteId', message('Văn phòng này không còn hoạt động. Bạn chọn văn phòng khác.'));
				return 'officeSiteId';
			case 'OFFICE_SUPPLY_DEPARTMENT_INVALID':
				setFieldError('departmentIds', message('Có phòng ban không còn hoạt động. Bạn chọn lại phòng tham gia.'));
				return 'departmentIds';
			default:
				formError.value = message('Chưa mở được kỳ đăng ký. Bạn thử lại sau ít phút.');
				return null;
		}
	}

	function onSubmit(onFieldError: (field: PeriodField) => void) {
		return handleSubmit(
			async values => {
				formError.value = '';
				try {
					await options.submit({
						officeSiteId: values.officeSiteId,
						month: values.month,
						deadline: values.deadline,
						title: values.title?.trim() || undefined,
						departmentIds: values.departmentIds,
					});
				} catch (e) {
					const field = applyServerError(e);
					if (field) onFieldError(field);
				}
			},
			({ errors: fieldErrors }) => {
				const field = firstErrorField(fieldErrors);
				if (field) onFieldError(field);
			},
		);
	}

	onMounted(() => {
		applySite(initialSite(), preset.value?.month);
		loadDepartments();
	});

	// Danh sách văn phòng tải xong sau khi hộp đã mở (bấm Thử lại): chọn sẵn văn phòng lúc đó.
	watch(sites, () => {
		if (!officeSiteId.value) applySite(initialSite(), preset.value?.month);
	});

	return {
		errors,
		isSubmitting,
		formError,
		officeSiteId,
		month,
		deadline,
		title,
		departmentIds,
		deadlineFromPrevious,
		latestForSite,
		loadingDepartments,
		departmentsError,
		activeDepartments,
		selectedCount,
		allSelected,
		excludedNames,
		monthOptions,
		duplicate,
		siteName,
		deadlineWeekday,
		lockLine,
		autoTitle,
		today,
		setSite,
		setMonth,
		setDeadline,
		setDepartments,
		toggleDepartment,
		loadDepartments,
		focusField,
		onSubmit,
	};
}
