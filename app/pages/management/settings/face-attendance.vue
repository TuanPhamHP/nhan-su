<script setup lang="ts">
	import FaceConfirmDialog from '~/components/modules/attendance/FaceConfirmDialog.vue';
	import type { FaceSettingsResponseDto, FaceStatusItemDto } from '~/types/attendance.types';
	import { filterFaceStatus, type FaceRegisteredFilter } from '~/utils/attendance-face.utils';
	import { FACE_PERMISSIONS } from '~/utils/permission';
	import { formatDate, formatDateTime } from '~/utils/date';

	/**
	 * Cài đặt chấm công bằng khuôn mặt.
	 *
	 * Công tắc chỉ bấm được với `attendance:face:setting` (mặc định chỉ ADMIN); HR thấy trạng thái
	 * nhưng không đổi được. Danh sách đăng ký, xem ảnh và xoá cần `attendance:face:manage`.
	 */
	definePageMeta({ title: 'Chấm công bằng khuôn mặt' });

	const toast = useToast();
	const { hasPermission } = usePermissions();
	const imageViewer = useImageViewerStore();
	const face = useAttendanceFace();
	const listApi = useAttendanceFace();

	const canSetting = computed(() => hasPermission(FACE_PERMISSIONS.setting));
	const canManage = computed(() => hasPermission(FACE_PERMISSIONS.manage));

	const settings = ref<FaceSettingsResponseDto | null>(null);
	const confirmToggle = ref(false);

	const items = ref<FaceStatusItemDto[]>([]);
	const statusFilter = ref<FaceRegisteredFilter>('all');
	const search = ref('');
	const openingPhotoId = ref<number | null>(null);
	const resetTarget = ref<FaceStatusItemDto | null>(null);

	const filtered = computed(() => filterFaceStatus(items.value, statusFilter.value, search.value));
	const registeredCount = computed(() => items.value.filter(i => i.registeredAt).length);
	const filterTabs = computed<{ key: FaceRegisteredFilter; label: string }[]>(() => [
		{ key: 'all', label: `Tất cả (${items.value.length})` },
		{ key: 'registered', label: `Đã đăng ký (${registeredCount.value})` },
		{ key: 'unregistered', label: `Chưa đăng ký (${items.value.length - registeredCount.value})` },
	]);

	async function loadSettings() {
		try {
			settings.value = await face.getSettings();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được cài đặt');
		}
	}

	async function loadList() {
		if (!canManage.value) return;
		try {
			items.value = await listApi.listEmployees();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được danh sách');
		}
	}

	async function applyToggle() {
		if (!settings.value) return;
		const next = !settings.value.enabled;
		try {
			settings.value = await face.updateSettings(next);
			confirmToggle.value = false;
			toast.success(next ? 'Đã bật chấm công bằng khuôn mặt' : 'Đã tắt chấm công bằng khuôn mặt');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không đổi được cài đặt');
		}
	}

	async function viewPhoto(item: FaceStatusItemDto) {
		openingPhotoId.value = item.employeeId;
		try {
			const detail = await listApi.getEmployee(item.employeeId);
			if (detail.photoUrl) imageViewer.open([detail.photoUrl], 0);
			else toast.info('Người này chưa có ảnh khuôn mặt');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không mở được ảnh');
		} finally {
			openingPhotoId.value = null;
		}
	}

	async function applyReset() {
		const target = resetTarget.value;
		if (!target) return;
		try {
			await listApi.resetEmployee(target.employeeId);
			items.value = items.value.map(i => (i.employeeId === target.employeeId ? { ...i, registeredAt: null } : i));
			resetTarget.value = null;
			toast.success(`Đã xoá khuôn mặt của ${target.fullName}`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không xoá được khuôn mặt');
		}
	}

	onMounted(() => {
		loadSettings();
		loadList();
	});
</script>

<template>
	<div class="space-y-5">
		<div class="flex items-center gap-2">
			<NuxtLink
				to="/management/settings"
				class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
				aria-label="Về trang Cài đặt"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
				</svg>
			</NuxtLink>
			<UiPageHeader
				title="Chấm công bằng khuôn mặt"
				description="Khi bật, máy chủ so ảnh chụp lúc chấm công với khuôn mặt nhân viên đã đăng ký. Không khớp thì nhân viên vẫn xác nhận được, lượt đó hiện ở bảng chấm công để phòng nhân sự xem lại."
			/>
		</div>

		<!-- Công tắc -->
		<div
			class="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
			data-testid="face-setting-card"
		>
			<div class="min-w-0">
				<p class="text-sm font-semibold text-gray-900 dark:text-white">
					{{ settings?.enabled ? 'Đang bật' : 'Đang tắt' }}
				</p>
				<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
					<template v-if="settings?.enabled">Nhân viên phải đăng ký khuôn mặt trước khi chấm công.</template>
					<template v-else>Nhân viên chấm công như trước, không so khuôn mặt.</template>
					<template v-if="settings?.updatedAt"> Đổi lần cuối {{ formatDateTime(settings.updatedAt) }}.</template>
				</p>
				<p v-if="!canSetting" class="mt-1 text-xs text-gray-400 dark:text-gray-500">
					Chỉ quản trị viên bật tắt được.
				</p>
			</div>
			<button
				type="button"
				role="switch"
				:aria-checked="!!settings?.enabled"
				aria-label="Chấm công bằng khuôn mặt"
				:disabled="!settings || !canSetting || face.saving.value"
				:class="[
					'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
					settings?.enabled ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-600',
				]"
				data-testid="face-setting-switch"
				@click="confirmToggle = true"
			>
				<span
					:class="[
						'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
						settings?.enabled ? 'translate-x-5' : 'translate-x-0',
					]"
				/>
			</button>
		</div>

		<!-- Danh sách đăng ký -->
		<div v-if="canManage" class="space-y-3">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex w-full gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 dark:bg-gray-800 sm:w-fit">
					<button
						v-for="tab in filterTabs"
						:key="tab.key"
						type="button"
						class="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
						:class="
							statusFilter === tab.key
								? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
								: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
						"
						@click="statusFilter = tab.key"
					>
						{{ tab.label }}
					</button>
				</div>
				<input
					v-model="search"
					type="search"
					placeholder="Tìm tên hoặc mã nhân viên"
					class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 sm:max-w-xs"
					data-testid="face-search"
				/>
			</div>

			<div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60">
							<th class="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
								Nhân viên
							</th>
							<th class="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
								Phòng ban
							</th>
							<th class="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
								Khuôn mặt
							</th>
							<th class="px-4 py-3" />
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-if="listApi.loading.value && !items.length">
							<td colspan="4" class="px-4 py-10 text-center text-sm text-gray-400">Đang tải...</td>
						</tr>
						<tr v-else-if="!filtered.length">
							<td colspan="4" class="px-4 py-10 text-center text-sm text-gray-400">Không có nhân viên nào</td>
						</tr>
						<tr v-for="item in filtered" :key="item.employeeId" data-testid="face-row">
							<td class="whitespace-nowrap px-4 py-3">
								<p class="font-medium text-gray-900 dark:text-white">{{ item.fullName }}</p>
								<p class="text-xs text-gray-400 dark:text-gray-500">{{ item.employeeCode }}</p>
							</td>
							<td class="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
								{{ item.department?.name ?? '—' }}
							</td>
							<td class="whitespace-nowrap px-4 py-3">
								<span
									v-if="item.registeredAt"
									class="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400"
								>
									Đăng ký {{ formatDate(item.registeredAt) }}
								</span>
								<span
									v-else
									class="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
								>
									Chưa đăng ký
								</span>
							</td>
							<td class="whitespace-nowrap px-4 py-3 text-right">
								<div v-if="item.registeredAt" class="flex justify-end gap-2">
									<CommonAppButton
										size="sm"
										variant="ghost"
										:loading="openingPhotoId === item.employeeId"
										@click="viewPhoto(item)"
									>
										Xem ảnh
									</CommonAppButton>
									<CommonAppButton size="sm" variant="danger_outline" @click="resetTarget = item">Xoá</CommonAppButton>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<FaceConfirmDialog
		v-if="confirmToggle && settings"
		:title="settings.enabled ? 'Tắt chấm công bằng khuôn mặt?' : 'Bật chấm công bằng khuôn mặt?'"
		:message="
			settings.enabled
				? 'Nhân viên sẽ chấm công như trước, không so khuôn mặt. Khuôn mặt đã đăng ký vẫn được giữ.'
				: 'Từ lúc bật, mọi nhân viên phải đăng ký khuôn mặt trước lần chấm công tới.'
		"
		:confirm-label="settings.enabled ? 'Tắt' : 'Bật'"
		:danger="settings.enabled"
		:busy="face.saving.value"
		@confirm="applyToggle"
		@cancel="confirmToggle = false"
	/>

	<FaceConfirmDialog
		v-if="resetTarget"
		title="Xoá khuôn mặt"
		:message="`Xoá khuôn mặt của ${resetTarget.fullName}? Người này phải đăng ký lại trước lần chấm công tới.`"
		confirm-label="Xoá"
		danger
		:busy="listApi.saving.value"
		@confirm="applyReset"
		@cancel="resetTarget = null"
	/>
</template>
