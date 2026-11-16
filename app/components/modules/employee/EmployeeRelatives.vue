<script setup lang="ts">
	import { formatDate } from '~/utils/date';
	import { dependentPeriodText, relativeRoleTags } from '~/utils/hr-profile.utils';
	import { useEmployeeProfileService } from '~/services/employee-profile.service';
	import RelativeFormModal from '~/components/modules/employee/RelativeFormModal.vue';
	import type { CreateRelativeDto, Relative } from '~/types/hr-profile.types';

	/**
	 * Tab Thân nhân của một nhân viên (UI-02, lô 3a).
	 *
	 * Response có số định danh nên tab này chỉ hiện với người có `employee:private:read`, và
	 * thêm, sửa, xoá còn cần `employee:update`. Mỗi lần mở tab được ghi vào nhật ký hệ thống.
	 */
	const props = defineProps<{
		employeeId: number;
		employeeName: string;
		canUpdate: boolean;
	}>();

	const toast = useToast();
	const service = useEmployeeProfileService();

	const items = ref<Relative[]>([]);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const submitting = ref(false);
	const showForm = ref(false);
	const formTarget = ref<Relative | null>(null);
	const removeTarget = ref<Relative | null>(null);
	/** Cảnh báo BR-04 của lần lưu gần nhất: số định danh đang là người phụ thuộc của người khác. */
	const warnings = ref<string[]>([]);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			items.value = await service.findRelatives(props.employeeId);
		} catch (e) {
			loadError.value = e instanceof Error ? e.message : 'Chưa tải được danh sách thân nhân.';
		} finally {
			loading.value = false;
		}
	}

	function openCreate() {
		formTarget.value = null;
		warnings.value = [];
		showForm.value = true;
	}

	function openEdit(item: Relative) {
		formTarget.value = item;
		warnings.value = [];
		showForm.value = true;
	}

	async function onSubmit(payload: CreateRelativeDto) {
		submitting.value = true;
		try {
			const target = formTarget.value;
			const result = target
				? await service.updateRelative(props.employeeId, target.id, payload)
				: await service.createRelative(props.employeeId, payload);
			// Đặt người liên hệ chính mới làm người cũ mất cờ, nên đọc lại cả danh sách thay vì
			// chỉ thay một dòng.
			await load();
			warnings.value = result.warnings;
			showForm.value = false;
			toast.success(target ? 'Đã lưu thông tin thân nhân.' : `Đã thêm thân nhân cho ${props.employeeName}.`);
		} catch (e) {
			// Form cố ý không đóng: người dùng sửa lại đúng chỗ BE báo lỗi rồi gửi tiếp.
			toast.error(e instanceof Error ? e.message : 'Chưa lưu được. Bạn thử lại sau ít phút.');
		} finally {
			submitting.value = false;
		}
	}

	async function confirmRemove() {
		const target = removeTarget.value;
		if (!target) return;
		submitting.value = true;
		try {
			await service.removeRelative(props.employeeId, target.id);
			items.value = items.value.filter(i => i.id !== target.id);
			removeTarget.value = null;
			warnings.value = [];
			toast.success('Đã xoá thân nhân khỏi hồ sơ.');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa xoá được. Bạn thử lại sau ít phút.');
		} finally {
			submitting.value = false;
		}
	}

	onMounted(load);

	const dependentCount = computed(() => items.value.filter(i => i.isDependent && !i.dependentTo).length);
</script>

<template>
	<div class="space-y-4">
		<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
			<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
				<div class="min-w-0">
					<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Thân nhân và người phụ thuộc</h3>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
						Đang có {{ dependentCount }} người phụ thuộc được giảm trừ. Mỗi lần xem danh sách này được ghi vào
						nhật ký hệ thống.
					</p>
				</div>
				<CommonAppButton v-if="canUpdate" size="sm" @click="openCreate">Thêm thân nhân</CommonAppButton>
			</div>

			<!-- Cảnh báo BR-04 -->
			<div
				v-if="warnings.length"
				class="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20"
			>
				<p class="text-sm font-medium text-amber-800 dark:text-amber-200">Hệ thống vẫn lưu, nhưng bạn nên rà lại</p>
				<ul class="mt-1 space-y-0.5">
					<li v-for="(w, i) in warnings" :key="i" class="text-xs text-amber-700 dark:text-amber-300">{{ w }}</li>
				</ul>
			</div>

			<div v-if="loading" class="p-6 space-y-3">
				<div v-for="i in 3" :key="i" class="h-12 w-full bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse" />
			</div>

			<div v-else-if="loadError" class="p-6 flex flex-wrap items-center justify-between gap-3">
				<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
				<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
			</div>

			<p v-else-if="!items.length" class="px-6 py-8 text-sm text-gray-500 dark:text-gray-400">
				{{ employeeName }} chưa có thân nhân nào trong hồ sơ. Bạn thêm người phụ thuộc để tính giảm trừ thuế, hoặc
				thêm người liên hệ khi có việc khẩn cấp.
			</p>

			<!-- Điện thoại: mỗi thân nhân một thẻ. Bảng bảy cột ở khung hẹp đẩy cả nút Sửa và Xoá
			     ra ngoài màn hình, người dùng phải kéo ngang mới thao tác được. -->
			<ul v-else class="divide-y divide-gray-100 dark:divide-gray-800 sm:hidden">
				<li v-for="item in items" :key="item.id" class="space-y-1 px-4 py-3">
					<div class="flex items-start justify-between gap-2">
						<p class="font-medium text-gray-900 dark:text-white">{{ item.fullName }}</p>
						<span class="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">{{ item.relationshipLabel }}</span>
					</div>
					<p class="text-xs text-gray-400 dark:text-gray-500">
						<span v-if="item.dateOfBirth">{{ formatDate(item.dateOfBirth) }}</span>
						<span v-if="item.dateOfBirth && item.identityNumber" class="mx-1">·</span>
						<span v-if="item.identityNumber" class="font-mono">{{ item.identityNumber }}</span>
						<span v-if="item.phone"> · {{ item.phone }}</span>
					</p>
					<div class="flex flex-wrap gap-1">
						<span
							v-for="tag in relativeRoleTags(item)"
							:key="tag"
							class="inline-flex rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
						>
							{{ tag }}
						</span>
					</div>
					<p v-if="item.isDependent" class="text-xs text-gray-500 dark:text-gray-400">
						Giảm trừ {{ dependentPeriodText(item) }} · {{ item.registrationLabel ?? 'Chưa đăng ký' }}
					</p>
					<p v-if="item.note" class="text-xs text-gray-500 dark:text-gray-400">{{ item.note }}</p>
					<div v-if="canUpdate" class="flex gap-1.5 pt-1">
						<button
							type="button"
							class="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
							@click="openEdit(item)"
						>
							Sửa
						</button>
						<button
							type="button"
							class="rounded-md px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
							@click="removeTarget = item"
						>
							Xoá
						</button>
					</div>
				</li>
			</ul>

			<div v-if="items.length" class="hidden overflow-x-auto sm:block">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
							<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
								Họ tên
							</th>
							<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
								Quan hệ
							</th>
							<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
								Liên hệ khẩn cấp
							</th>
							<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
								Người phụ thuộc
							</th>
							<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
								Giảm trừ
							</th>
							<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
								Đăng ký
							</th>
							<th
								v-if="canUpdate"
								class="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
							>
								Thao tác
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-for="item in items" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
							<td class="px-4 py-3">
								<p class="font-medium text-gray-900 dark:text-white">{{ item.fullName }}</p>
								<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
									<span v-if="item.dateOfBirth">{{ formatDate(item.dateOfBirth) }}</span>
									<span v-if="item.dateOfBirth && item.identityNumber" class="mx-1">·</span>
									<span v-if="item.identityNumber" class="font-mono">{{ item.identityNumber }}</span>
								</p>
								<p v-if="item.note" class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ item.note }}</p>
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300">
								{{ item.relationshipLabel }}
								<p v-if="item.livesWith" class="text-xs text-gray-400 dark:text-gray-500">Sống cùng</p>
							</td>
							<td class="px-4 py-3">
								<span
									v-if="item.isPrimaryEmergency"
									class="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
								>
									Liên hệ chính
								</span>
								<span v-else-if="item.isEmergencyContact" class="text-xs text-gray-600 dark:text-gray-300">Có</span>
								<span v-else class="text-xs text-gray-400 dark:text-gray-500">—</span>
								<p v-if="item.phone" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ item.phone }}</p>
							</td>
							<td class="px-4 py-3">
								<span v-if="item.isDependent" class="text-sm text-gray-700 dark:text-gray-300">Có</span>
								<span v-else class="text-xs text-gray-400 dark:text-gray-500">—</span>
							</td>
							<td class="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300 tabular-nums">
								{{ dependentPeriodText(item) }}
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ item.registrationLabel ?? '—' }}</td>
							<td v-if="canUpdate" class="px-4 py-3">
								<div class="flex items-center justify-end gap-1.5">
									<button
										type="button"
										class="px-2.5 py-1 rounded-md text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
										@click="openEdit(item)"
									>
										Sửa
									</button>
									<button
										type="button"
										class="px-2.5 py-1 rounded-md text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
										@click="removeTarget = item"
									>
										Xoá
									</button>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<RelativeFormModal
			v-if="showForm"
			:target="formTarget"
			:submitting="submitting"
			:note="`Thay đổi về người phụ thuộc sẽ gửi một thông báo cho ${employeeName}.`"
			@submit="onSubmit"
			@close="showForm = false"
		/>

		<Teleport to="body">
			<div
				v-if="removeTarget"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
				@click.self="removeTarget = null"
			>
				<div
					class="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
				>
					<h3 class="font-semibold text-gray-900 dark:text-white">Xoá thân nhân</h3>
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
						Hệ thống sẽ xoá {{ removeTarget.fullName }} khỏi hồ sơ của {{ employeeName }}. Nếu người này đang được
						giảm trừ thuế thì khoản giảm trừ cũng dừng lại.
					</p>
					<div class="mt-6 flex justify-end gap-3">
						<CommonAppButton variant="outline" @click="removeTarget = null">Giữ lại</CommonAppButton>
						<CommonAppButton variant="danger" :loading="submitting" @click="confirmRemove">Xoá</CommonAppButton>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>
