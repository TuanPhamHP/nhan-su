<script setup lang="ts">
	import { PERIOD_FIELD_IDS, PERIOD_TITLE_MAX, usePeriodCreateForm } from '~/composables/usePeriodCreateForm';
	import type { PeriodCreatePreset } from '~/composables/useSupplyPeriods';
	import { monthLabel, supplyStatusMeta } from '~/utils/office.utils';
	import type { CreateSupplyPeriodBody, OfficeSite, SupplyPeriod } from '~/types/office.types';

	/**
	 * Hộp "Mở kỳ đăng ký văn phòng phẩm".
	 *
	 * Mọi ô điền sẵn theo kỳ gần nhất của văn phòng nên mở kỳ tháng sau chỉ cần xác nhận. Nút Mở kỳ
	 * không bao giờ xám câm: thiếu gì thì bấm vào sẽ nhảy tới ô đó kèm câu lỗi, còn lý do chặn hẳn (đã
	 * có kỳ tháng này, chưa có phòng nào) thì ghi ngay trên nút.
	 */
	const props = defineProps<{
		sites: OfficeSite[];
		/** Mọi kỳ, không lọc: để tính mặc định và chặn mở trùng. */
		periods: SupplyPeriod[];
		preset?: PeriodCreatePreset | null;
		loadingSites: boolean;
		sitesError: string | null;
		/** Người xem tạo được văn phòng ở Cài đặt hành chính. */
		canSetUpOffice: boolean;
		submit: (body: CreateSupplyPeriodBody) => Promise<SupplyPeriod>;
	}>();

	const emit = defineEmits<{
		close: [];
		retrySites: [];
	}>();

	const {
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
	} = usePeriodCreateForm({
		sites: toRef(props, 'sites'),
		periods: toRef(props, 'periods'),
		preset: toRef(props, 'preset'),
		submit: props.submit,
	});

	const panelRef = ref<HTMLElement | null>(null);
	const editingTitle = ref(false);
	const departmentsOpen = ref(false);

	useFocusTrap(panelRef);
	useEscapeKey(
		() => emit('close'),
		() => !isSubmitting.value,
	);

	const siteOptions = computed(() => props.sites.map(s => ({ value: s.id, label: s.name })));

	/** Lý do chặn hẳn việc mở kỳ, ghi ngay trên nút. Thiếu ô bắt buộc thì không chặn ở đây. */
	const blocker = computed(() => {
		if (!props.sites.length) return 'Chưa có văn phòng nào.';
		if (duplicate.value) return `Đã có kỳ ${monthLabel(duplicate.value.month).toLocaleLowerCase('vi')} của ${siteName.value}.`;
		if (loadingDepartments.value) return 'Đang tải danh sách phòng ban…';
		if (departmentsError.value) return 'Chưa tải được danh sách phòng ban.';
		if (!activeDepartments.value.length) return 'Công ty chưa có phòng ban nào để mời.';
		return '';
	});

	/** Thiếu ô gì, nói ra ngay trên nút khi người dùng đã bấm Mở kỳ một lần. */
	const missing = computed(() => {
		const names: string[] = [];
		if (errors.value.officeSiteId) names.push('Văn phòng');
		if (errors.value.month) names.push('Tháng chi phí');
		if (errors.value.deadline) names.push('Hạn chót');
		if (errors.value.title) names.push('Tiêu đề');
		if (errors.value.departmentIds) names.push('Phòng tham gia');
		return names;
	});

	const excludedLabel = computed(() => {
		const names = excludedNames.value;
		if (names.length <= 3) return names.join(', ');
		return `${names.slice(0, 3).join(', ')} và ${names.length - 3} phòng khác`;
	});

	function openField(field: keyof typeof PERIOD_FIELD_IDS) {
		if (field === 'title') editingTitle.value = true;
		if (field === 'departmentIds') departmentsOpen.value = true;
		nextTick(() => focusField(field));
	}

	const submitForm = onSubmit(openField);

	function resetTitle() {
		title.value = '';
		editingTitle.value = false;
	}

	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-2 sm:p-4"
			@click.self="!isSubmitting && emit('close')"
		>
			<div
				ref="panelRef"
				role="dialog"
				aria-modal="true"
				aria-labelledby="period-create-title"
				class="flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col rounded-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-4rem)] dark:bg-gray-900"
			>
				<div class="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-6 dark:border-gray-700">
					<h2 id="period-create-title" class="text-base font-semibold text-gray-900 dark:text-white">
						Mở kỳ đăng ký văn phòng phẩm
					</h2>
					<button
						type="button"
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng hộp mở kỳ đăng ký"
						:disabled="isSubmitting"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form id="period-create-form" class="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6" novalidate @submit.prevent="submitForm">
					<!-- Văn phòng -->
					<div v-if="loadingSites" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
					<div
						v-else-if="sitesError"
						class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
					>
						<span>{{ sitesError }}</span>
						<CommonAppButton size="sm" variant="outline" @click="emit('retrySites')">Thử lại</CommonAppButton>
					</div>
					<div v-else-if="!sites.length" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
						Công ty chưa có văn phòng nào nên chưa mở kỳ được.
						<template v-if="canSetUpOffice">
							Bạn tạo văn phòng ở
							<NuxtLink to="/management/office/settings?tab=places" class="font-medium underline">
								Cài đặt hành chính → Văn phòng và phòng họp</NuxtLink
							>.
						</template>
						<template v-else>Bạn nhờ người quản trị tạo văn phòng ở Cài đặt hành chính.</template>
					</div>

					<template v-else>
						<div data-tour="period-form-basics" class="space-y-5">
							<div class="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
								<label :for="PERIOD_FIELD_IDS.officeSiteId" :class="[labelCls, 'sm:pt-2']">
									Văn phòng <span class="text-rose-500">*</span>
								</label>
								<div>
									<!-- Một văn phòng thì không có gì để chọn, hiện tên cho gọn. -->
									<p
										v-if="sites.length === 1"
										:id="PERIOD_FIELD_IDS.officeSiteId"
										tabindex="-1"
										class="pt-2 text-sm font-medium text-gray-900 dark:text-white"
									>
										{{ siteName }}
									</p>
									<UiSelect
										v-else
										:id="PERIOD_FIELD_IDS.officeSiteId"
										:model-value="officeSiteId"
										:options="siteOptions"
										placeholder="Chọn văn phòng"
										:error="errors.officeSiteId"
										@update:model-value="setSite"
									/>
									<p v-if="sites.length === 1 && errors.officeSiteId" class="mt-1 text-xs text-rose-600 dark:text-rose-400">
										{{ errors.officeSiteId }}
									</p>
								</div>
							</div>

							<div class="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
								<label :for="PERIOD_FIELD_IDS.month" :class="[labelCls, 'sm:pt-2']">
									Tháng chi phí <span class="text-rose-500">*</span>
								</label>
								<div class="space-y-1">
									<UiSelect
										:id="PERIOD_FIELD_IDS.month"
										:model-value="month"
										:options="monthOptions"
										:error="errors.month"
										@update:model-value="setMonth"
									/>
									<p
										v-if="duplicate"
										id="period-month-duplicate"
										role="alert"
										class="text-xs font-medium text-rose-600 dark:text-rose-400"
									>
										Đã có kỳ {{ monthLabel(duplicate.month).toLocaleLowerCase('vi') }} của {{ siteName }} ·
										<NuxtLink
											:to="`/management/office/supply-periods/${duplicate.id}`"
											class="underline hover:no-underline"
											@click="emit('close')"
											>Xem kỳ</NuxtLink
										>
									</p>
									<p v-if="latestForSite" class="text-xs text-gray-500 dark:text-gray-400">
										Kỳ gần nhất: {{ monthLabel(latestForSite.month) }} ·
										{{ supplyStatusMeta(latestForSite.status).label.toLocaleLowerCase('vi') }}
									</p>
									<p v-else class="text-xs text-gray-500 dark:text-gray-400">Văn phòng này chưa có kỳ nào.</p>
								</div>
							</div>

							<div class="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
								<label :for="PERIOD_FIELD_IDS.deadline" :class="[labelCls, 'sm:pt-2']">
									Hạn chót <span class="text-rose-500">*</span>
								</label>
								<div class="space-y-1">
									<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
										<div class="w-48">
											<UiDatePicker
												:id="PERIOD_FIELD_IDS.deadline"
												:model-value="deadline"
												:min="today"
												:error="errors.deadline"
												@update:model-value="setDeadline"
											/>
										</div>
										<span
											v-if="deadlineWeekday"
											:class="[
												'text-sm',
												deadlineWeekday.weekend ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400',
											]"
										>
											{{ deadlineWeekday.label }}<template v-if="deadlineWeekday.weekend"> · cuối tuần</template>
										</span>
									</div>
									<p aria-live="polite" class="text-xs text-gray-600 dark:text-gray-400">
										<template v-if="lockLine">
											{{ lockLine }}<template v-if="deadlineFromPrevious"> · điền sẵn theo kỳ trước</template>
										</template>
										<template v-else>Phiếu tự khoá lúc 00:00 ngày sau hạn chót, không có nút nộp.</template>
									</p>
								</div>
							</div>

							<div class="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
								<span :class="[labelCls, 'sm:pt-1']">Tiêu đề</span>
								<div>
									<div v-if="!editingTitle" class="flex flex-wrap items-center gap-2 pt-1 text-sm">
										<span class="text-gray-900 dark:text-white">{{ title?.trim() || autoTitle }}</span>
										<span v-if="!title?.trim()" class="text-gray-500 dark:text-gray-400">(tự động)</span>
										<button
											type="button"
											class="rounded px-1 font-medium text-brand-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-400"
											@click="openField('title')"
										>
											Sửa
										</button>
									</div>
									<div v-else class="space-y-1">
										<input
											:id="PERIOD_FIELD_IDS.title"
											v-model="title"
											type="text"
											:maxlength="PERIOD_TITLE_MAX"
											:placeholder="autoTitle"
											:aria-invalid="errors.title ? 'true' : undefined"
											aria-describedby="period-title-hint"
											class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
										/>
										<p id="period-title-hint" :class="['text-xs', errors.title ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400']">
											{{ errors.title || 'Bỏ trống thì kỳ lấy tên theo tháng.' }}
											<button type="button" class="ml-1 font-medium text-brand-600 hover:underline dark:text-brand-400" @click="resetTitle">
												Dùng tên tự động
											</button>
										</p>
									</div>
								</div>
							</div>
						</div>

						<fieldset data-tour="period-form-departments" class="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
							<legend class="sr-only">Phòng tham gia</legend>
							<span :class="[labelCls, 'sm:pt-1']" aria-hidden="true">Phòng tham gia <span class="text-rose-500">*</span></span>
							<div>
								<div v-if="loadingDepartments" class="h-8 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
								<div v-else-if="departmentsError" class="flex flex-wrap items-center gap-2 text-sm text-rose-700 dark:text-rose-300">
									<span>{{ departmentsError }}</span>
									<CommonAppButton size="sm" variant="outline" @click="loadDepartments">Thử lại</CommonAppButton>
								</div>
								<p v-else-if="!activeDepartments.length" class="pt-1 text-sm text-gray-500 dark:text-gray-400">
									Công ty chưa có phòng ban nào đang hoạt động.
								</p>
								<template v-else>
									<div v-if="!departmentsOpen" class="flex flex-wrap items-center gap-2 pt-1 text-sm">
										<span class="text-gray-900 dark:text-white">
											<template v-if="allSelected">Tất cả {{ activeDepartments.length }} phòng</template>
											<template v-else>
												{{ selectedCount }}/{{ activeDepartments.length }} phòng<template v-if="selectedCount"> · bỏ: {{ excludedLabel }}</template>
											</template>
										</span>
										<button
											:id="PERIOD_FIELD_IDS.departmentIds"
											type="button"
											:aria-expanded="departmentsOpen"
											aria-controls="period-departments-list"
											class="rounded px-1 font-medium text-brand-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-400"
											@click="departmentsOpen = true"
										>
											Chỉnh sửa
										</button>
									</div>
									<div v-else id="period-departments-list" class="space-y-2">
										<div class="flex flex-wrap items-center gap-3 text-xs">
											<span class="font-medium text-gray-700 dark:text-gray-300" aria-live="polite">
												Đã chọn {{ selectedCount }}/{{ activeDepartments.length }}
											</span>
											<button
												:id="PERIOD_FIELD_IDS.departmentIds"
												type="button"
												class="font-medium text-brand-600 hover:underline dark:text-brand-400"
												@click="setDepartments(allSelected ? [] : activeDepartments.map(d => d.id))"
											>
												{{ allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả' }}
											</button>
											<button
												type="button"
												class="ml-auto font-medium text-gray-600 hover:underline dark:text-gray-400"
												@click="departmentsOpen = false"
											>
												Thu gọn
											</button>
										</div>
										<div
											class="grid max-h-56 grid-cols-1 gap-x-3 overflow-y-auto rounded-lg border border-gray-200 p-2 sm:grid-cols-2 dark:border-gray-700"
											:aria-describedby="errors.departmentIds ? 'period-departments-error' : undefined"
										>
											<label
												v-for="d in activeDepartments"
												:key="d.id"
												class="flex cursor-pointer items-start gap-2 rounded px-1 py-1.5 text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
											>
												<input
													type="checkbox"
													class="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
													:checked="departmentIds?.includes(d.id)"
													@change="toggleDepartment(d.id)"
												/>
												<span class="[overflow-wrap:anywhere]">{{ d.name }}</span>
											</label>
										</div>
									</div>
									<p v-if="errors.departmentIds" id="period-departments-error" class="mt-1 text-xs text-rose-600 dark:text-rose-400">
										{{ errors.departmentIds }}
									</p>
								</template>
							</div>
						</fieldset>
					</template>

					<p
						v-if="formError"
						role="alert"
						class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
					>
						{{ formError }}
					</p>
				</form>

				<!-- Chân hộp dính đáy: thân hộp cuộn khi màn thấp, nút Mở kỳ luôn thấy. -->
				<div class="space-y-2 border-t border-gray-200 px-4 py-3 sm:px-6 dark:border-gray-700">
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Sẽ tạo {{ selectedCount }} phiếu trống và gửi thông báo cho các phòng.
					</p>
					<p v-if="blocker || missing.length" role="status" class="text-sm font-medium text-rose-600 dark:text-rose-400">
						{{ blocker || `Thiếu: ${missing.join(', ')}` }}
					</p>
					<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<CommonAppButton variant="secondary" :disabled="isSubmitting" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton
							data-tour="period-form-submit"
							variant="primary"
							type="submit"
							form="period-create-form"
							:disabled="!!blocker"
							:loading="isSubmitting"
						>
							Mở kỳ cho {{ selectedCount }} phòng
						</CommonAppButton>
					</div>
				</div>
			</div>
		</div>
	</Teleport>
</template>
