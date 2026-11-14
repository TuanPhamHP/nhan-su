<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import { INCIDENT_STATUS_CLASS } from '~/utils/asset.utils';
	import { formatDate, formatDateTime, todayYmd } from '~/utils/date';
	import type { AssetIncident, AssetVendor } from '~/types/asset.types';

	/**
	 * Chi tiết một báo hỏng, báo mất, kèm chỗ xử lý.
	 *
	 * Bốn cách xử lý (tạo phiếu sửa, đóng không cần sửa, xác nhận mất, đã tìm thấy) đều hỏi
	 * thêm vài ô rồi gọi một route khác nhau. Gom vào cùng hộp thoại này thay vì mở hộp thoại
	 * chồng lên hộp thoại: người xử lý vẫn nhìn thấy mô tả và ảnh trong lúc điền.
	 *
	 * `mine` để trang "Tài sản của tôi" dùng lại: nhân viên mở ảnh của chính mình bằng route
	 * `/v1/me/...`, còn người quản lý dùng route quản lý.
	 */
	const props = withDefaults(
		defineProps<{
			incident: AssetIncident;
			canManage?: boolean;
			mine?: boolean;
		}>(),
		{ canManage: false, mine: false },
	);

	const emit = defineEmits<{
		handled: [incident: AssetIncident];
		/** Người khác đã xử lý báo cáo này trước: nơi gọi tải lại danh sách. */
		stale: [];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();

	type ActionId = 'repair' | 'close-damage' | 'confirm-loss' | 'found';

	const action = ref<ActionId | null>(null);
	const note = ref('');
	const lostOn = ref(props.incident.occurredOn ?? todayYmd());
	const vendorId = ref<number>(0);
	const underWarranty = ref(false);
	const vendors = ref<AssetVendor[]>([]);
	const vendorsError = ref(false);
	const submitting = ref(false);

	/** URL ảnh lấy khi mở hộp thoại; presigned sống một giờ nên không lưu lại đâu khác. */
	const photoUrls = ref<{ id: number; url: string }[]>([]);
	const loadingPhotos = ref(false);
	const photoError = ref<string | null>(null);

	const isOpen = computed(() => props.incident.status === 'OPEN');
	const isLoss = computed(() => props.incident.type === 'LOSS');
	const canHandle = computed(() => props.canManage && isOpen.value);
	const assetCode = computed(() => props.incident.asset.code);

	/**
	 * Kết quả của phiếu sửa tạo từ báo hỏng. Báo cáo `RESOLVED` nghĩa là phiếu đã đóng; báo cáo
	 * còn `REPAIR_OPENED` thì phiếu đang làm, nói rõ để người báo khỏi tưởng đã xong.
	 */
	const maintenanceSummary = computed(() => {
		const m = props.incident.maintenance;
		if (!m) return null;
		const closed = ['DONE', 'UNREPAIRABLE', 'CANCELLED'].includes(m.status);
		return {
			closed,
			title: closed ? `Kết quả phiếu sửa: ${m.statusLabel}` : `Phiếu sửa đang ở trạng thái ${m.statusLabel}`,
			doneAt: m.doneAt ? formatDate(m.doneAt) : null,
			workDone: m.workDone,
		};
	});

	useEscapeKey(
		() => emit('close'),
		() => !submitting.value,
	);

	onMounted(loadPhotos);

	async function loadPhotos() {
		if (!props.incident.photoDocumentIds.length) return;
		loadingPhotos.value = true;
		photoError.value = null;
		try {
			const urls = await Promise.all(
				props.incident.photoDocumentIds.map(async id => ({
					id,
					url: props.mine ? await service.myDocumentUrl(id) : await service.documentUrl(id),
				})),
			);
			photoUrls.value = urls;
		} catch (e) {
			photoError.value = e instanceof Error ? e.message : 'Chưa mở được ảnh kèm theo. Bạn thử lại sau ít phút.';
		} finally {
			loadingPhotos.value = false;
		}
	}

	async function pickAction(id: ActionId) {
		action.value = id;
		note.value = '';
		if (id === 'repair' && !vendors.value.length) {
			try {
				vendors.value = await service.findVendors({ isActive: true });
				vendorsError.value = false;
			} catch {
				// Ô chọn đơn vị sửa rỗng, vẫn tạo phiếu được vì đơn vị sửa là tuỳ chọn.
				vendorsError.value = true;
			}
		}
	}

	const vendorOptions = computed(() => [
		{ value: 0, label: 'Không chọn' },
		...vendors.value.map(v => ({ value: v.id, label: v.name })),
	]);

	const actionTitle = computed(() => {
		switch (action.value) {
			case 'repair':
				return 'Tạo phiếu sửa';
			case 'close-damage':
				return 'Đóng, không cần sửa';
			case 'confirm-loss':
				return 'Xác nhận mất';
			case 'found':
				return 'Đã tìm thấy';
			default:
				return '';
		}
	});

	/** Nói trước tài sản sẽ ra sao, để người xử lý không phải đoán. */
	const actionHint = computed(() => {
		switch (action.value) {
			case 'repair':
				return 'Hệ thống mở một phiếu sửa mang sẵn mô tả và ảnh của báo cáo này, tài sản chuyển sang Đang sửa.';
			case 'close-damage':
				return 'Báo hỏng được đóng lại, tài sản giữ nguyên trạng thái hiện tại và người báo nhận được thông báo kèm ghi chú bên dưới.';
			case 'confirm-loss':
				return 'Tài sản chuyển sang Mất, lần cấp phát đang mở được đóng và khấu hao dừng từ ngày mất. Nếu là điện thoại hay máy tính, bạn nhớ khoá SIM, đổi mật khẩu các tài khoản trên máy và xoá dữ liệu từ xa nếu làm được.';
			case 'found':
				return 'Tài sản quay về trạng thái trước khi báo mất, người đang giữ giữ nguyên.';
			default:
				return '';
		}
	});

	async function submit() {
		if (!action.value || submitting.value) return;
		submitting.value = true;
		try {
			const body = { note: note.value.trim() || undefined };
			let saved: AssetIncident;
			const reporter = props.incident.reportedBy.name;
			if (action.value === 'repair') {
				saved = await service.repairFromIncident(props.incident.id, {
					...body,
					vendorId: vendorId.value || undefined,
					underWarranty: underWarranty.value,
				});
				toast.success(
					`Đã tạo phiếu sửa cho ${assetCode.value} từ báo hỏng của ${reporter}. Tài sản chuyển sang Đang sửa và ${reporter} sẽ nhận được thông báo.`,
				);
			} else if (action.value === 'confirm-loss') {
				saved = await service.confirmIncidentLoss(props.incident.id, {
					...body,
					lostOn: lostOn.value || undefined,
				});
				toast.success(
					`Đã xác nhận ${assetCode.value} bị mất từ ngày ${formatDate(lostOn.value || todayYmd())}. ${reporter} sẽ nhận được thông báo.`,
				);
			} else {
				saved = await service.closeIncident(props.incident.id, body);
				toast.success(
					action.value === 'found'
						? `Đã ghi nhận tìm thấy ${assetCode.value}, tài sản trở về trạng thái trước khi báo mất.`
						: `Đã đóng báo hỏng ${assetCode.value} mà không cần sửa. ${reporter} sẽ nhận được thông báo.`,
				);
			}
			emit('handled', saved);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa xử lý được báo cáo. Bạn thử lại sau ít phút.');
			// Chỉ khi người khác đã xử lý xong (409 ASSET_INCIDENT_HANDLED) mới đóng hộp và nhờ nơi
			// gọi tải lại, vì dữ liệu đang xem đã cũ. Lỗi khác, nhất là mất mạng, giữ nguyên hộp để
			// ghi chú và ngày mất vừa nhập không bị mất.
			const code = (e as { data?: { error?: { code?: string } } }).data?.error?.code;
			if (code === 'ASSET_INCIDENT_HANDLED') emit('stale');
		} finally {
			submitting.value = false;
		}
	}

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
			role="dialog"
			aria-modal="true"
			:aria-label="`${incident.typeLabel} ${incident.asset.code}`"
		>
			<div class="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-start justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ incident.typeLabel }}</h2>
							<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="INCIDENT_STATUS_CLASS[incident.status]">
								{{ incident.statusLabel }}
							</span>
						</div>
						<p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
							<span class="font-mono">{{ incident.asset.code }}</span> · {{ incident.asset.name }} ·
							{{ incident.asset.statusLabel }}
						</p>
					</div>
					<button
						type="button"
						class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:h-8 sm:w-8 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						:aria-label="`Đóng hộp ${incident.typeLabel.toLowerCase()}`"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="space-y-5 p-6">
					<dl class="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
						<div class="flex gap-4 border-b border-gray-100 py-2 dark:border-gray-800">
							<dt class="w-32 flex-shrink-0 text-sm text-gray-500 dark:text-gray-400">Người báo</dt>
							<dd class="min-w-0 flex-1 text-sm text-gray-900 dark:text-gray-100">{{ incident.reportedBy.name }}</dd>
						</div>
						<div class="flex gap-4 border-b border-gray-100 py-2 dark:border-gray-800">
							<dt class="w-32 flex-shrink-0 text-sm text-gray-500 dark:text-gray-400">Ngày phát hiện</dt>
							<dd class="min-w-0 flex-1 text-sm text-gray-900 dark:text-gray-100">
								{{ incident.occurredOn ? formatDate(incident.occurredOn) : '—' }}
							</dd>
						</div>
						<div class="flex gap-4 border-b border-gray-100 py-2 dark:border-gray-800">
							<dt class="w-32 flex-shrink-0 text-sm text-gray-500 dark:text-gray-400">Gửi lúc</dt>
							<dd class="min-w-0 flex-1 text-sm text-gray-900 dark:text-gray-100">{{ formatDateTime(incident.createdAt) }}</dd>
						</div>
						<div v-if="incident.handledBy" class="flex gap-4 border-b border-gray-100 py-2 dark:border-gray-800">
							<dt class="w-32 flex-shrink-0 text-sm text-gray-500 dark:text-gray-400">Người xử lý</dt>
							<dd class="min-w-0 flex-1 text-sm text-gray-900 dark:text-gray-100">
								{{ incident.handledBy.name }}
								<span class="text-xs text-gray-400">{{ formatDateTime(incident.handledAt) }}</span>
							</dd>
						</div>
					</dl>

					<div class="space-y-1">
						<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
							{{ mine ? 'Nội dung bạn đã gửi' : 'Nội dung người báo gửi' }}
						</p>
						<p class="whitespace-pre-line rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
							{{ incident.description }}
						</p>
					</div>

					<div v-if="incident.handlingNote" class="space-y-1">
						<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Ghi chú khi xử lý</p>
						<p class="whitespace-pre-line rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
							{{ incident.handlingNote }}
						</p>
					</div>

					<!-- Phiếu sửa tạo từ báo hỏng: đang làm hay đã xong, kết quả ra sao. -->
					<div
						v-if="maintenanceSummary"
						class="space-y-1 rounded-lg px-3 py-2"
						:class="
							maintenanceSummary.closed
								? 'bg-emerald-50 dark:bg-emerald-900/20'
								: 'bg-blue-50 dark:bg-blue-900/20'
						"
					>
						<p class="text-sm font-medium text-gray-900 dark:text-white">{{ maintenanceSummary.title }}</p>
						<p v-if="maintenanceSummary.doneAt" class="text-sm text-gray-700 dark:text-gray-300">
							Ngày xong {{ maintenanceSummary.doneAt }}.
						</p>
						<p v-if="maintenanceSummary.workDone" class="text-sm text-gray-700 dark:text-gray-300">
							Đã làm: {{ maintenanceSummary.workDone }}
						</p>
						<p v-if="!maintenanceSummary.closed && mine" class="text-sm text-gray-700 dark:text-gray-300">
							Bạn sẽ nhận được thông báo khi phiếu sửa đóng.
						</p>
					</div>

					<p v-if="incident.maintenanceId && !mine" class="text-sm">
						<NuxtLink
							:to="`/management/assets/${incident.asset.id}?tab=maintenances&maintenance_id=${incident.maintenanceId}`"
							class="text-brand-600 hover:underline dark:text-brand-400"
						>
							Xem phiếu sửa đã tạo từ báo cáo này
						</NuxtLink>
					</p>

					<!-- Ảnh kèm theo -->
					<div class="space-y-2">
						<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Ảnh kèm theo
							<span v-if="incident.photoDocumentIds.length" class="text-xs font-normal text-gray-500">
								{{ incident.photoDocumentIds.length }}
							</span>
						</p>
						<p v-if="!incident.photoDocumentIds.length" class="text-sm text-gray-600 dark:text-gray-400">
							Báo cáo này không kèm ảnh.
						</p>
						<div v-else-if="loadingPhotos" class="flex gap-3">
							<div v-for="i in incident.photoDocumentIds.length" :key="i" class="h-24 w-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
						</div>
						<div
							v-else-if="photoError"
							class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-800 dark:bg-rose-900/20"
						>
							<p class="text-sm text-rose-700 dark:text-rose-300">{{ photoError }}</p>
							<CommonAppButton size="sm" variant="outline" @click="loadPhotos">Thử lại</CommonAppButton>
						</div>
						<div v-else class="flex flex-wrap gap-3">
							<a
								v-for="(photo, i) in photoUrls"
								:key="photo.id"
								:href="photo.url"
								target="_blank"
								rel="noopener noreferrer"
								class="block overflow-hidden rounded-lg border border-gray-200 transition hover:border-brand-500 dark:border-gray-700"
							>
								<img
									:src="photo.url"
									:alt="`Ảnh ${i + 1} của ${incident.typeLabel.toLowerCase()} ${incident.asset.code}`"
									class="h-24 w-24 object-cover"
								/>
							</a>
						</div>
					</div>

					<!-- Xử lý -->
					<div v-if="canHandle" class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
						<p class="text-sm font-semibold text-gray-800 dark:text-gray-100">Xử lý {{ incident.typeLabel.toLowerCase() }}</p>

						<div v-if="!action" class="mt-3 flex flex-wrap gap-2">
							<template v-if="isLoss">
								<CommonAppButton variant="primary" @click="pickAction('confirm-loss')">Xác nhận mất</CommonAppButton>
								<CommonAppButton variant="outline" @click="pickAction('found')">Đã tìm thấy</CommonAppButton>
							</template>
							<template v-else>
								<CommonAppButton variant="primary" @click="pickAction('repair')">Tạo phiếu sửa</CommonAppButton>
								<CommonAppButton variant="outline" @click="pickAction('close-damage')">Đóng, không cần sửa</CommonAppButton>
							</template>
						</div>

						<div v-else class="mt-3 space-y-4">
							<p class="text-sm font-medium text-gray-900 dark:text-white">{{ actionTitle }}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">{{ actionHint }}</p>

							<div v-if="action === 'confirm-loss'" class="space-y-1">
								<label :class="labelCls">Ngày mất</label>
								<UiDatePicker v-model="lostOn" :max="todayYmd()" />
								<p class="text-xs text-gray-500 dark:text-gray-400">Khấu hao dừng từ ngày này. Mặc định là ngày nhân viên khai.</p>
							</div>

							<div v-if="action === 'repair'" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div class="space-y-1">
									<label :class="labelCls">Đơn vị sửa chữa</label>
									<UiSelectInput v-model="vendorId" :options="vendorOptions" placeholder="Không chọn" />
									<p v-if="vendorsError" class="text-xs text-amber-700 dark:text-amber-400">
										Chưa tải được danh sách đơn vị. Bạn vẫn tạo phiếu được và chọn đơn vị sau.
									</p>
								</div>
								<label class="flex items-center gap-2 pt-6">
									<input v-model="underWarranty" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
									<span class="text-sm text-gray-700 dark:text-gray-300">Còn bảo hành</span>
								</label>
							</div>

							<div class="space-y-1">
								<label :class="labelCls">Ghi chú</label>
								<textarea v-model="note" rows="2" :class="`${inputCls} resize-none`" placeholder="Người báo sẽ đọc được ghi chú này" />
							</div>

							<div class="flex justify-end gap-3">
								<CommonAppButton variant="secondary" :disabled="submitting" @click="action = null">Quay lại</CommonAppButton>
								<CommonAppButton variant="primary" :loading="submitting" @click="submit">{{ actionTitle }}</CommonAppButton>
							</div>
						</div>
					</div>

					<p
						v-else-if="canManage && !isOpen"
						class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400"
					>
						{{ incident.typeLabel }} này đã được xử lý nên không còn thao tác nào.
					</p>
				</div>
			</div>
		</div>
	</Teleport>
</template>
