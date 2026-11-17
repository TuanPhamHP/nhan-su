<script setup lang="ts">
	import TemplateFormModal from '~/components/modules/general-request/TemplateFormModal.vue';
	import { useGeneralRequestService } from '~/services/general-request.service';
	import { REQUEST_PERMISSIONS } from '~/utils/permission';
	import { REQUEST_CATEGORY_LABELS, type DocumentTemplateDetail } from '~/types/general-request.types';

	/**
	 * Loại phiếu đề xuất (UI-05, lô 4a).
	 *
	 * Trước lô 4a danh sách này nằm trong một khối bật tắt ở trang Cài đặt. Giờ mỗi loại phiếu có
	 * thêm luồng duyệt riêng, tiền tố số hiệu và người theo dõi mặc định, nên nó thành một trang
	 * riêng và mỗi dòng mở được màn luồng duyệt.
	 *
	 * Cửa vào là quyền `request-type:manage` (trước là vai trò nhân sự hoặc quản trị viên). Người
	 * không có quyền vẫn tới được địa chỉ này nên trang tự nói rõ, thay vì hiện bảng rỗng.
	 */
	definePageMeta({ title: 'Loại phiếu đề xuất' });

	const toast = useToast();
	const service = useGeneralRequestService();
	const { hasPermission } = usePermissions();

	const canManage = computed(() => hasPermission(REQUEST_PERMISSIONS.typeManage));

	const templates = ref<DocumentTemplateDetail[]>([]);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const showForm = ref(false);
	const formTarget = ref<DocumentTemplateDetail | undefined>(undefined);
	const togglingId = ref<number | null>(null);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			templates.value = await service.findTemplates();
		} catch (e) {
			loadError.value = e instanceof Error ? e.message : 'Chưa tải được danh sách loại phiếu.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	function openCreate() {
		formTarget.value = undefined;
		showForm.value = true;
	}

	function openEdit(template: DocumentTemplateDetail) {
		formTarget.value = template;
		showForm.value = true;
	}

	function onSaved(saved: DocumentTemplateDetail) {
		showForm.value = false;
		const idx = templates.value.findIndex(t => t.id === saved.id);
		if (idx === -1) templates.value = [saved, ...templates.value];
		else templates.value.splice(idx, 1, saved);
	}

	async function toggleActive(template: DocumentTemplateDetail) {
		togglingId.value = template.id;
		try {
			const updated = await service.updateTemplate(template.id, { isActive: !template.isActive });
			const idx = templates.value.findIndex(t => t.id === template.id);
			if (idx !== -1) templates.value.splice(idx, 1, updated);
			toast.success(updated.isActive ? 'Đã bật lại loại phiếu.' : 'Đã tắt loại phiếu.');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa đổi được trạng thái loại phiếu.');
		} finally {
			togglingId.value = null;
		}
	}
</script>

<template>
	<div class="space-y-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Loại phiếu đề xuất</h1>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					Mỗi loại phiếu có biểu mẫu riêng, mẫu in riêng và luồng duyệt riêng.
				</p>
			</div>
			<CommonAppButton v-if="canManage" @click="openCreate">
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				Tạo loại phiếu
			</CommonAppButton>
		</div>

		<div
			v-if="!canManage"
			class="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900"
		>
			<p class="text-base font-medium text-gray-900 dark:text-white">Bạn không có quyền cấu hình loại phiếu</p>
			<p class="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
				Việc này cần quyền quản lý loại phiếu. Bạn liên hệ quản trị viên nếu cần cấu hình biểu mẫu hoặc luồng duyệt.
			</p>
		</div>

		<template v-else>
			<div v-if="loading" class="space-y-2">
				<div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="loadError"
				class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-900/10"
			>
				<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
				<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
			</div>

			<div
				v-else-if="!templates.length"
				class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				Chưa có loại phiếu nào. Bạn bấm "Tạo loại phiếu" để thêm loại đầu tiên.
			</div>

			<template v-else>
				<!-- Điện thoại -->
				<ul class="space-y-2 sm:hidden">
					<li
						v-for="template in templates"
						:key="template.id"
						class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
					>
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<p class="text-sm font-medium text-gray-900 dark:text-white">{{ template.name }}</p>
								<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
									Nhóm {{ REQUEST_CATEGORY_LABELS[template.category] ?? template.category }}, số hiệu bắt đầu bằng
									{{ template.codePrefix }}
								</p>
							</div>
							<span
								class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
								:class="
									template.isActive
										? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
										: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
								"
							>
								{{ template.isActive ? 'Đang dùng' : 'Đã tắt' }}
							</span>
						</div>
						<p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
							{{ template.fields.length }} trường · {{ template.defaultWatcherIds.length }} người theo dõi mặc định
						</p>
					<!-- Trên điện thoại ba nút này nằm một hàng hẹp, nên nút phải đủ cao để bấm không trượt. -->
						<div class="mt-3 flex flex-wrap gap-2">
							<NuxtLink :to="`/management/settings/request-types/${template.id}/flow`">
								<CommonAppButton variant="secondary" class="min-h-11">Sửa luồng duyệt</CommonAppButton>
							</NuxtLink>
							<CommonAppButton variant="secondary" class="min-h-11" @click="openEdit(template)">
								Sửa loại phiếu
							</CommonAppButton>
							<CommonAppButton
								variant="secondary"
								class="min-h-11"
								:loading="togglingId === template.id"
								@click="toggleActive(template)"
							>
								{{ template.isActive ? 'Tắt loại phiếu' : 'Bật lại' }}
							</CommonAppButton>
						</div>
					</li>
				</ul>

				<!-- Máy tính -->
				<div
					class="hidden overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 sm:block"
				>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Loại phiếu</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nhóm</th>
									<th class="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tiền tố</th>
									<th class="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Biểu mẫu</th>
									<th class="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Người theo dõi</th>
									<th class="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
									<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Thao tác</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
								<tr
									v-for="template in templates"
									:key="template.id"
									class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
								>
									<td class="px-4 py-3">
										<p class="font-medium text-gray-900 dark:text-white">{{ template.name }}</p>
										<p v-if="template.description" class="mt-0.5 text-xs text-gray-400">{{ template.description }}</p>
									</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-300">
										{{ REQUEST_CATEGORY_LABELS[template.category] ?? template.category }}
									</td>
									<td class="whitespace-nowrap px-4 py-3 font-medium text-gray-700 dark:text-gray-200">
										{{ template.codePrefix }}
									</td>
									<td class="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
										{{ template.fields.length }} trường
									</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-300">
										{{
											template.defaultWatcherIds.length
												? `${template.defaultWatcherIds.length} người theo dõi mặc định`
												: 'Không có'
										}}
									</td>
									<td class="px-4 py-3">
										<span
											class="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
											:class="
												template.isActive
													? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
													: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
											"
										>
											{{ template.isActive ? 'Đang dùng' : 'Đã tắt' }}
										</span>
									</td>
									<td class="px-4 py-3">
										<div class="flex items-center justify-end gap-1.5">
											<NuxtLink
												:to="`/management/settings/request-types/${template.id}/flow`"
												class="whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/20"
											>
												Sửa luồng duyệt
											</NuxtLink>
											<button
												type="button"
												class="whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
												@click="openEdit(template)"
											>
												Sửa loại phiếu
											</button>
											<button
												type="button"
												class="whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
												:disabled="togglingId === template.id"
												@click="toggleActive(template)"
											>
												{{ template.isActive ? 'Tắt loại phiếu' : 'Bật lại' }}
											</button>
										</div>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</template>
		</template>

		<Teleport to="body">
			<TemplateFormModal
				v-if="showForm"
				:edit-target="formTarget"
				@saved="onSaved"
				@close="showForm = false"
			/>
		</Teleport>
	</div>
</template>
