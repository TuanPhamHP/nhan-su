<script setup lang="ts">
	import { useOfficeService } from '~/services/office.service';
	import { monthLabel, nextMonthValue, officeErrorCode, officeErrorMessage } from '~/utils/office.utils';
	import { formatDate, todayYmd } from '~/utils/date';
	import type { OfficeSite, SupplyPeriod } from '~/types/office.types';

	/**
	 * Mở một kỳ đăng ký văn phòng phẩm cho một văn phòng.
	 *
	 * Phòng tham gia mặc định lấy theo KỲ GẦN NHẤT của văn phòng đó: tháng nào cũng gần như cùng
	 * một danh sách phòng, nên bắt HCNS tick lại chín phòng mỗi tháng là việc vô ích. Chưa có kỳ
	 * nào thì tick sẵn mọi phòng đang hoạt động, vì kỳ đầu tiên thường mời cả công ty.
	 */
	const props = defineProps<{
		sites: OfficeSite[];
		/** Kỳ đã có, để đoán danh sách phòng của kỳ trước. */
		periods: SupplyPeriod[];
	}>();

	const emit = defineEmits<{
		created: [period: SupplyPeriod];
		close: [];
	}>();

	const toast = useToast();
	const service = useOfficeService();
	const directoryStore = useDirectoryStore();
	const { departments } = storeToRefs(directoryStore);

	const officeSiteId = ref<number | undefined>(props.sites[0]?.id);
	const month = ref(nextMonthValue());
	const deadline = ref('');
	const title = ref('');
	const departmentIds = ref<number[]>([]);
	const deadlineError = ref('');
	/** Câu lỗi của ô tháng, ví dụ khi máy chủ nói tháng đã qua. */
	const monthError = ref('');
	const saving = ref(false);
	const loadingDefaults = ref(false);

	// Người dùng vừa sửa ô nào thì câu lỗi cũ của ô đó hết đúng: để treo lại thì họ sửa xong vẫn
	// thấy câu đỏ và không biết mình còn sai ở đâu.
	watch(month, () => {
		monthError.value = '';
	});
	watch(deadline, () => {
		deadlineError.value = '';
	});

	const siteOptions = computed(() => props.sites.map(s => ({ value: s.id, label: s.name })));

	/**
	 * Từ tháng này tới một năm tới.
	 *
	 * KHÔNG còn tháng trước: máy chủ từ chối tháng đã qua (`OFFICE_SUPPLY_PERIOD_MONTH_PAST`), nên
	 * bày nó ra chỉ dẫn người dùng vào một cú bấm chắc chắn thất bại. Mở trước cả năm nghe xa,
	 * nhưng danh sách ngắn hơn thì HCNS lập kế hoạch đầu năm cho cả năm sẽ thiếu tháng để chọn.
	 */
	const monthOptions = computed(() => {
		const now = new Date();
		const options: Array<{ value: string; label: string }> = [];
		for (let offset = 0; offset <= 12; offset++) {
			const at = new Date(now.getFullYear(), now.getMonth() + offset, 1);
			const value = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
			options.push({ value, label: monthLabel(value) });
		}
		return options;
	});

	const activeDepartments = computed(() => departments.value.filter(d => d.isActive));

	function toggleDepartment(id: number) {
		departmentIds.value = departmentIds.value.includes(id)
			? departmentIds.value.filter(x => x !== id)
			: [...departmentIds.value, id];
	}

	function selectAllDepartments() {
		departmentIds.value = activeDepartments.value.map(d => d.id);
	}

	/**
	 * Phòng của kỳ gần nhất cùng văn phòng; không có kỳ nào thì mọi phòng.
	 *
	 * Danh sách kỳ đã mang sẵn `departmentIds` nên không phải gọi thêm chi tiết kỳ trước.
	 */
	function applyPreviousDepartments() {
		const siteId = officeSiteId.value;
		if (!siteId) return;
		const previous = props.periods.filter(p => p.officeSite.id === siteId).sort((a, b) => b.id - a.id)[0];
		const ids = previous?.departmentIds ?? [];
		if (ids.length) {
			departmentIds.value = [...ids];
			return;
		}
		// Kỳ đầu tiên của văn phòng này thường mời cả công ty, nên tick sẵn mọi phòng.
		selectAllDepartments();
	}

	/**
	 * Tháng mặc định: tháng gần nhất mà văn phòng đang chọn CHƯA có kỳ.
	 *
	 * Để cứng "tháng sau" thì HCNS mở kỳ hai lần trong tháng sẽ nhận câu "văn phòng này đã có kỳ
	 * tháng ..." rồi phải tự dò từng tháng trong danh sách để tìm chỗ trống.
	 */
	function applyFreeMonth() {
		const siteId = officeSiteId.value;
		if (!siteId) return;
		const taken = new Set(props.periods.filter(p => p.officeSite.id === siteId).map(p => p.month));
		const free = monthOptions.value.map(option => option.value).find(value => !taken.has(value));
		if (free) month.value = free;
	}

	/** Đổi văn phòng thì cả phòng tham gia và tháng trống đều tính lại cho văn phòng đó. */
	watch(officeSiteId, () => {
		applyPreviousDepartments();
		applyFreeMonth();
	});

	onMounted(async () => {
		loadingDefaults.value = true;
		try {
			await directoryStore.load();
		} catch {
			toast.error('Chưa tải được danh sách phòng ban. Bạn đóng hộp rồi mở lại.');
		} finally {
			loadingDefaults.value = false;
		}
		applyPreviousDepartments();
		applyFreeMonth();
	});

	useEscapeKey(
		() => emit('close'),
		() => !saving.value,
	);

	async function submit() {
		if (!officeSiteId.value || !month.value || !deadline.value || !departmentIds.value.length || saving.value) return;
		saving.value = true;
		deadlineError.value = '';
		monthError.value = '';
		try {
			const created = await service.createPeriod({
				officeSiteId: officeSiteId.value,
				month: month.value,
				deadline: deadline.value,
				title: title.value.trim() || undefined,
				departmentIds: departmentIds.value,
			});
			toast.success(
				// Ngày hiện theo cách người Việt đọc, không phải `2026-12-25` của máy.
				`Đã mở kỳ ${created.title} cho ${departmentIds.value.length} phòng, hạn chót ngày ${formatDate(created.deadline)}. Nhân viên các phòng vừa nhận thông báo.`,
			);
			emit('created', created);
		} catch (e) {
			const code = officeErrorCode(e);
			// Hạn chót là lỗi của đúng ô ngày; còn trùng tháng là lỗi của cả kỳ nên nói bằng toast.
			if (code === 'OFFICE_SUPPLY_DEADLINE_PAST' || code === 'OFFICE_SUPPLY_DEADLINE_INVALID') {
				deadlineError.value = officeErrorMessage(e, 'Hạn chót phải là ngày từ hôm nay trở đi.');
			} else if (code === 'OFFICE_SUPPLY_PERIOD_MONTH_PAST') {
				// Tháng đã qua là lỗi của ô THÁNG, không phải của cả kỳ: câu của máy chủ đã nói luôn
				// tháng nên chọn, nên để ngay dưới ô đó.
				monthError.value = officeErrorMessage(e, 'Tháng này đã qua. Bạn chọn tháng hiện tại hoặc tháng sau.');
			} else {
				toast.error(officeErrorMessage(e, 'Chưa mở được kỳ đăng ký. Bạn thử lại sau ít phút.'));
			}
		} finally {
			saving.value = false;
		}
	}

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-label="Mở kỳ đăng ký văn phòng phẩm"
		>
			<div class="my-4 w-full max-w-2xl rounded-2xl bg-white shadow-xl sm:my-8 dark:bg-gray-900">
				<div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Mở kỳ đăng ký văn phòng phẩm</h2>
						<p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
							Mỗi phòng tham gia có sẵn một phiếu rỗng và cả phòng nhận thông báo. Phiếu tự khoá lúc 00:00 ngày
							sau hạn chót, không có nút nộp.
						</p>
					</div>
					<button
						type="button"
						class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:h-8 sm:w-8 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng hộp mở kỳ đăng ký"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-5 p-4 sm:p-6" @submit.prevent="submit">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<label :class="labelCls">Văn phòng <span class="text-red-500">*</span></label>
							<UiSelect v-model="officeSiteId" :options="siteOptions" placeholder="Chọn văn phòng" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Tháng chi phí <span class="text-red-500">*</span></label>
							<UiSelect v-model="month" :options="monthOptions" :error="monthError" />
							<p v-if="monthError" class="text-xs text-red-500">{{ monthError }}</p>
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Hạn chót nhập <span class="text-red-500">*</span></label>
							<UiDatePicker v-model="deadline" :min="todayYmd()" :error="deadlineError" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Tiêu đề</label>
							<input v-model="title" type="text" maxlength="200" :class="inputCls" :placeholder="monthLabel(month)" />
							<p class="text-xs text-gray-500 dark:text-gray-400">Bỏ trống thì kỳ lấy tên theo tháng.</p>
						</div>
					</div>

					<fieldset class="space-y-1">
						<legend :class="labelCls">
							Phòng tham gia <span class="text-red-500">*</span>
							<span class="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
								đã chọn {{ departmentIds.length }} phòng
							</span>
						</legend>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Mặc định là các phòng của kỳ gần nhất ở văn phòng này.
						</p>
						<div v-if="loadingDefaults" class="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
						<div v-else class="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
							<label
								v-for="d in activeDepartments"
								:key="d.id"
								class="flex min-h-11 cursor-pointer items-center gap-2 rounded px-1 text-sm text-gray-800 hover:bg-gray-50 sm:min-h-0 sm:py-1 dark:text-gray-200 dark:hover:bg-gray-800"
							>
								<input
									type="checkbox"
									class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
									:checked="departmentIds.includes(d.id)"
									@change="toggleDepartment(d.id)"
								/>
								{{ d.name }}
							</label>
							<p v-if="!activeDepartments.length" class="px-1 py-2 text-sm text-gray-500 dark:text-gray-400">
								Chưa có phòng ban nào trong công ty.
							</p>
						</div>
						<button type="button" class="text-xs text-brand-600 hover:underline dark:text-brand-400" @click="selectAllDepartments">
							Chọn mọi phòng
						</button>
					</fieldset>

					<div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
						<CommonAppButton variant="secondary" type="button" class="min-h-11 sm:min-h-0" @click="emit('close')">
							Đóng
						</CommonAppButton>
						<CommonAppButton
							variant="primary"
							type="submit"
							class="min-h-11 sm:min-h-0"
							:disabled="!officeSiteId || !deadline || !departmentIds.length"
							:loading="saving"
						>
							Mở kỳ
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
