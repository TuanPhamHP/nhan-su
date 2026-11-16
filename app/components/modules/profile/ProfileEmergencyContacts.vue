<script setup lang="ts">
	import { dependentPeriodText, relativeRoleTags } from '~/utils/hr-profile.utils';
	import { useMeProfileService } from '~/services/me-profile.service';
	import RelativeFormModal from '~/components/modules/employee/RelativeFormModal.vue';
	import ProfilePendingRequestNotice from '~/components/modules/profile/ProfilePendingRequestNotice.vue';
	import type { CreateRelativeDto, MyProfileChange, Relative } from '~/types/hr-profile.types';

	/**
	 * Liên hệ khẩn cấp của chính mình (UI-04, lô 3a).
	 *
	 * Người chỉ là liên hệ khẩn cấp thì nhân viên tự thêm, sửa, xoá được ngay. Người đang là
	 * người phụ thuộc giảm trừ thuế thì không, vì sửa họ là sửa số thuế phải nộp: thay đổi đó
	 * đi qua đề nghị cho phòng nhân sự duyệt. Server cũng chặn bằng 409
	 * `PROFILE_RELATIVE_NEEDS_REQUEST`, nên nhánh đó vẫn được giữ làm lưới an toàn.
	 */
	const props = defineProps<{
		pendingRelativeRequests: MyProfileChange[];
	}>();

	const emit = defineEmits<{
		created: [];
		cancelled: [];
	}>();

	const toast = useToast();
	const service = useMeProfileService();

	const items = ref<Relative[]>([]);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const submitting = ref(false);

	const showForm = ref(false);
	const formTarget = ref<Relative | null>(null);
	/** Form đang ở dạng gửi đề nghị thay vì lưu thẳng. */
	const requestMode = ref(false);
	const removeTarget = ref<Relative | null>(null);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			items.value = await service.findEmergencyContacts();
		} catch (e) {
			loadError.value = e instanceof Error ? e.message : 'Chưa tải được danh sách liên hệ khẩn cấp.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	function openCreate() {
		formTarget.value = null;
		requestMode.value = false;
		showForm.value = true;
	}

	function openEdit(item: Relative) {
		formTarget.value = item;
		// Người phụ thuộc thì mở luôn dạng đề nghị: bấm Lưu cũng chỉ nhận 409 từ máy chủ.
		requestMode.value = item.isDependent;
		showForm.value = true;
	}

	function needsRequest(e: unknown): boolean {
		return apiErrorCode(e) === 'PROFILE_RELATIVE_NEEDS_REQUEST';
	}

	async function onSubmit(payload: CreateRelativeDto) {
		submitting.value = true;
		try {
			if (requestMode.value) {
				await sendRequest(payload);
				return;
			}
			if (formTarget.value) {
				const updated = await service.updateEmergencyContact(formTarget.value.id, payload);
				const idx = items.value.findIndex(i => i.id === updated.id);
				if (idx !== -1) items.value.splice(idx, 1, updated);
				// Đặt người liên hệ chính mới thì người cũ mất cờ, nên đọc lại cả danh sách.
				await load();
				toast.success('Đã lưu liên hệ khẩn cấp.');
			} else {
				await service.createEmergencyContact(payload);
				await load();
				toast.success('Đã thêm liên hệ khẩn cấp.');
			}
			showForm.value = false;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa lưu được. Bạn thử lại sau ít phút.');
			// Người này vừa trở thành người phụ thuộc: chuyển form sang dạng đề nghị, giữ nguyên
			// những gì người dùng đã nhập.
			if (needsRequest(e)) requestMode.value = true;
		} finally {
			submitting.value = false;
		}
	}

	async function sendRequest(payload: CreateRelativeDto) {
		const target = formTarget.value;
		// Người thêm từ khối này luôn là liên hệ khẩn cấp; form dạng gọn không có ô đó nên gắn ở đây.
		const after = { ...payload, isEmergencyContact: true } as unknown as Record<string, unknown>;
		const result = await service.createChangeRequest({
			section: 'RELATIVE',
			action: target ? 'UPDATE' : 'CREATE',
			targetId: target?.id,
			after,
		});
		showForm.value = false;
		toast.success(
			result.supersededIds.length
				? 'Đã gửi đề nghị mới và huỷ đề nghị đang chờ trước đó, phòng nhân sự sẽ xem và duyệt.'
				: 'Đã gửi đề nghị thay đổi, chờ phòng nhân sự duyệt.',
		);
		emit('created');
	}

	async function confirmRemove() {
		const target = removeTarget.value;
		if (!target) return;
		submitting.value = true;
		try {
			if (target.isDependent) {
				await service.createChangeRequest({ section: 'RELATIVE', action: 'DELETE', targetId: target.id, after: {} });
				toast.success('Đã gửi đề nghị xoá, chờ phòng nhân sự duyệt.');
				emit('created');
			} else {
				await service.removeEmergencyContact(target.id);
				items.value = items.value.filter(i => i.id !== target.id);
				toast.success('Đã xoá liên hệ khẩn cấp.');
			}
			removeTarget.value = null;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa xoá được. Bạn thử lại sau ít phút.');
		} finally {
			submitting.value = false;
		}
	}

	const formNote = computed(() => {
		if (!requestMode.value) {
			return 'Người bạn thêm ở đây là liên hệ khi có việc khẩn cấp, không phải người phụ thuộc giảm trừ thuế.';
		}
		return 'Người này đang là người phụ thuộc giảm trừ thuế, nên thay đổi phải do phòng nhân sự duyệt. Bạn sửa rồi bấm Gửi đề nghị.';
	});
</script>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Liên hệ khẩn cấp</h3>
				<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
					Công ty gọi những người này khi bạn gặp sự cố. Bạn nên có một người liên hệ chính.
				</p>
			</div>
			<CommonAppButton size="sm" variant="outline" @click="openCreate">Thêm người liên hệ</CommonAppButton>
		</div>

		<div v-if="loading" class="mt-5 space-y-3">
			<div v-for="i in 2" :key="i" class="h-14 w-full animate-pulse rounded-lg bg-gray-50 dark:bg-gray-800" />
		</div>

		<div v-else-if="loadError" class="mt-5 flex flex-wrap items-center justify-between gap-3">
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
		</div>

		<p v-else-if="!items.length" class="mt-5 text-sm text-gray-500 dark:text-gray-400">
			Bạn chưa có người liên hệ khẩn cấp nào. Bạn thêm một người thân để công ty biết gọi cho ai khi cần.
		</p>

		<ul v-else class="mt-5 space-y-2">
			<li
				v-for="item in items"
				:key="item.id"
				class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="min-w-0">
					<p class="text-sm font-medium text-gray-900 dark:text-white">
						{{ item.fullName }}
						<span class="font-normal text-gray-500 dark:text-gray-400">· {{ item.relationshipLabel }}</span>
					</p>
					<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
						{{ item.phone ?? 'Chưa có số điện thoại' }}
						<template v-if="item.occupation"> · {{ item.occupation }}</template>
					</p>
					<div class="mt-1 flex flex-wrap gap-1">
						<span
							v-for="tag in relativeRoleTags(item)"
							:key="tag"
							class="inline-flex rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
						>
							{{ tag }}
						</span>
					</div>
					<p v-if="item.isDependent" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Giảm trừ {{ dependentPeriodText(item) }}
					</p>
				</div>
				<div class="flex flex-shrink-0 items-center gap-1.5">
					<button
						type="button"
						class="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
						@click="openEdit(item)"
					>
						{{ item.isDependent ? 'Đề nghị sửa' : 'Sửa' }}
					</button>
					<button
						type="button"
						class="rounded-md px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
						@click="removeTarget = item"
					>
						{{ item.isDependent ? 'Đề nghị xoá' : 'Xoá' }}
					</button>
				</div>
			</li>
		</ul>

		<ProfilePendingRequestNotice
			v-for="req in pendingRelativeRequests"
			:key="req.id"
			class="mt-4"
			:request="req"
			@cancelled="emit('cancelled')"
		/>

		<RelativeFormModal
			v-if="showForm"
			:target="formTarget"
			variant="emergency"
			:submitting="submitting"
			:submit-label="requestMode ? 'Gửi đề nghị' : 'Lưu'"
			:note="formNote"
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
					<h3 class="font-semibold text-gray-900 dark:text-white">
						{{ removeTarget.isDependent ? 'Đề nghị xoá người phụ thuộc' : 'Xoá liên hệ khẩn cấp' }}
					</h3>
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
						<template v-if="removeTarget.isDependent">
							{{ removeTarget.fullName }} đang là người phụ thuộc giảm trừ thuế, nên việc xoá phải do phòng nhân sự
							duyệt. Hệ thống sẽ gửi một đề nghị thay bạn.
						</template>
						<template v-else>
							Hệ thống sẽ xoá {{ removeTarget.fullName }} khỏi danh sách liên hệ khẩn cấp của bạn.
						</template>
					</p>
					<div class="mt-6 flex justify-end gap-3">
						<CommonAppButton variant="outline" @click="removeTarget = null">Giữ lại</CommonAppButton>
						<CommonAppButton variant="danger" :loading="submitting" @click="confirmRemove">
							{{ removeTarget.isDependent ? 'Gửi đề nghị' : 'Xoá' }}
						</CommonAppButton>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>
