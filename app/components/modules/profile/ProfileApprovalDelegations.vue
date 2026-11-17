<script setup lang="ts">
	import { storeToRefs } from 'pinia';
	import EmployeePicker from '~/components/modules/general-request/EmployeePicker.vue';
	import { useApprovalDelegationService } from '~/services/approval-delegation.service';
	import { formatDate, todayYmd } from '~/utils/date';
	import type { ApprovalDelegation } from '~/types/approval-delegation.types';

	/**
	 * Uỷ quyền duyệt (UI-06, lô 4a).
	 *
	 * Uỷ quyền chỉ đổi NGƯỜI GIỮ LƯỢT của những bước tới lượt trong khoảng ngày, chứ không cấp
	 * thêm quyền gì: phiếu ghi rõ "duyệt thay ai" và nhật ký cũng vậy. Bước đã tới lượt trước khi
	 * lập uỷ quyền thì vẫn của người cũ, nên khối này nói trước điều đó để người đi công tác không
	 * tưởng mọi phiếu đang chờ sẽ tự chuyển.
	 *
	 * Danh sách người nhận lấy từ danh bạ công ty, mà danh bạ chỉ mở cho vai trò quản lý. Nhân
	 * viên thường vẫn xem được uỷ quyền người khác giao cho mình, nhưng muốn tự lập thì nhờ phòng
	 * nhân sự, vì không có danh sách để chọn.
	 */
	const toast = useToast();
	const { user } = useAuth();
	const service = useApprovalDelegationService();
	const directoryStore = useDirectoryStore();
	const { employees: directoryEmployees } = storeToRefs(directoryStore);

	const items = ref<ApprovalDelegation[]>([]);
	const loading = ref(true);
	const loadError = ref<string | null>(null);

	const showForm = ref(false);
	const delegateIds = ref<number[]>([]);
	const startDate = ref<string | undefined>(todayYmd());
	const endDate = ref<string | undefined>(undefined);
	const note = ref('');
	const submitting = ref(false);
	const formError = ref<string | null>(null);
	const removingId = ref<number | null>(null);

	/** Có danh bạ thì mới chọn được người nhận uỷ quyền. */
	const canPickPeople = computed(() => directoryEmployees.value.length > 0);

	const mine = computed(() => items.value.filter(d => d.isMine));
	const received = computed(() => items.value.filter(d => !d.isMine));

	const people = computed(() =>
		directoryEmployees.value
			.filter(e => e.id !== user.value?.id)
			.map(e => ({ id: e.id, fullName: e.fullName, hint: e.department?.name ?? e.employeeCode })),
	);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			items.value = await service.findAll();
		} catch (e) {
			loadError.value = e instanceof Error ? e.message : 'Chưa tải được danh sách uỷ quyền.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(() => {
		load();
		directoryStore.load().catch(() => {});
	});

	function openForm() {
		delegateIds.value = [];
		startDate.value = todayYmd();
		endDate.value = undefined;
		note.value = '';
		formError.value = null;
		showForm.value = true;
	}

	async function submit() {
		formError.value = null;
		if (!delegateIds.value.length) {
			formError.value = 'Bạn chọn người nhận uỷ quyền.';
			return;
		}
		if (!startDate.value || !endDate.value) {
			formError.value = 'Bạn chọn đủ ô "Từ ngày" và ô "Đến ngày".';
			return;
		}
		if (endDate.value < startDate.value) {
			formError.value = 'Ngày kết thúc phải từ ngày bắt đầu trở đi.';
			return;
		}
		submitting.value = true;
		try {
			const created = await service.create({
				delegateId: delegateIds.value[0]!,
				startDate: startDate.value,
				endDate: endDate.value,
				note: note.value.trim() || undefined,
			});
			items.value = [created, ...items.value];
			showForm.value = false;
			toast.success('Đã lập uỷ quyền duyệt.');
		} catch (e) {
			// Chồng khoảng ngày (409) và các lỗi khác đều có câu tiếng Việt của máy chủ: hiện
			// nguyên văn ngay trong form để người dùng sửa ngày, thay vì chỉ một toast rồi mất.
			formError.value = e instanceof Error ? e.message : 'Chưa lập được uỷ quyền.';
			toast.error(formError.value);
		} finally {
			submitting.value = false;
		}
	}

	async function remove(delegation: ApprovalDelegation) {
		removingId.value = delegation.id;
		try {
			await service.remove(delegation.id);
			items.value = items.value.filter(d => d.id !== delegation.id);
			toast.success('Đã huỷ uỷ quyền.');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa huỷ được uỷ quyền.');
		} finally {
			removingId.value = null;
		}
	}

	function rangeText(delegation: ApprovalDelegation): string {
		return `Từ ${formatDate(delegation.startDate)} đến ${formatDate(delegation.endDate)}`;
	}
</script>

<template>
	<div class="space-y-5">
		<section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 class="text-sm font-semibold text-gray-900 dark:text-white">Uỷ quyền duyệt</h2>
					<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
						Khi bạn nghỉ hoặc đi công tác, người được uỷ quyền sẽ nhận lượt duyệt phiếu đề xuất trong khoảng ngày bạn
						chọn, và phiếu ghi rõ là duyệt thay bạn.
					</p>
				</div>
				<CommonAppButton v-if="canPickPeople" size="sm" variant="outline" @click="openForm">
					Lập uỷ quyền
				</CommonAppButton>
			</div>

			<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
				Bước đã tới lượt bạn trước khi lập uỷ quyền thì vẫn chờ bạn; những bước đó bạn tự chuyển lượt trên từng phiếu.
			</p>

			<p v-if="!canPickPeople" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
				Hệ thống chưa tải được danh bạ nhân viên nên chưa chọn được người nhận. Bạn tải lại trang hoặc nhờ phòng nhân sự
				lập giúp.
			</p>

			<div v-if="loading" class="mt-5 space-y-2">
				<div v-for="i in 2" :key="i" class="h-14 w-full animate-pulse rounded-lg bg-gray-50 dark:bg-gray-800" />
			</div>

			<div v-else-if="loadError" class="mt-5 flex flex-wrap items-center justify-between gap-3">
				<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
				<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
			</div>

			<template v-else>
				<!-- Tôi uỷ quyền cho người khác -->
				<div class="mt-5">
					<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
						Tôi uỷ quyền cho người khác
					</h3>
					<p v-if="!mine.length" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
						Bạn chưa uỷ quyền duyệt cho ai.
					</p>
					<ul v-else class="mt-2 space-y-2">
						<li
							v-for="delegation in mine"
							:key="delegation.id"
							class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
						>
							<div class="min-w-0">
								<p class="text-sm font-medium text-gray-900 dark:text-white">{{ delegation.delegate.fullName }}</p>
								<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ rangeText(delegation) }}</p>
								<p v-if="delegation.note" class="mt-0.5 text-xs italic text-gray-500 dark:text-gray-400">
									{{ delegation.note }}
								</p>
							</div>
							<button
								type="button"
								class="flex-shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
								:disabled="removingId === delegation.id"
								@click="remove(delegation)"
							>
								{{ removingId === delegation.id ? 'Đang huỷ…' : 'Huỷ uỷ quyền' }}
							</button>
						</li>
					</ul>
				</div>

				<!-- Người khác uỷ quyền cho tôi -->
				<div class="mt-5">
					<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
						Người khác uỷ quyền cho tôi
					</h3>
					<p v-if="!received.length" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
						Chưa ai uỷ quyền duyệt cho bạn.
					</p>
					<ul v-else class="mt-2 space-y-2">
						<li
							v-for="delegation in received"
							:key="delegation.id"
							class="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
						>
							<p class="text-sm font-medium text-gray-900 dark:text-white">{{ delegation.delegator.fullName }}</p>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ rangeText(delegation) }}</p>
							<p v-if="delegation.note" class="mt-0.5 text-xs italic text-gray-500 dark:text-gray-400">
								{{ delegation.note }}
							</p>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								Uỷ quyền này chỉ người lập mới huỷ được, nên bạn liên hệ người đó nếu muốn dừng sớm.
							</p>
						</li>
					</ul>
				</div>
			</template>
		</section>

		<Teleport to="body">
			<div
				v-if="showForm"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
				@click.self="showForm = false"
			>
				<div class="flex max-h-[92vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-900">
					<div class="flex-shrink-0 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
						<h3 class="text-base font-semibold text-gray-900 dark:text-white">Lập uỷ quyền duyệt</h3>
						<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
							Khoảng ngày tính từ hôm nay trở đi và dài nhất chín mươi ngày.
						</p>
					</div>
					<div class="flex-1 space-y-4 overflow-y-auto p-6">
						<EmployeePicker v-model="delegateIds" :people="people" single label="Người nhận uỷ quyền" />
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<UiDatePicker
								:model-value="startDate"
								label="Từ ngày"
								:min="todayYmd()"
								@update:model-value="value => (startDate = value)"
							/>
							<UiDatePicker
								:model-value="endDate"
								label="Đến ngày"
								:min="startDate ?? todayYmd()"
								@update:model-value="value => (endDate = value)"
							/>
						</div>
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Ghi chú <span class="font-normal text-gray-400">(không bắt buộc)</span>
							</label>
							<textarea
								v-model="note"
								rows="2"
								placeholder="VD Đi công tác Hà Nội"
								class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>
						<p v-if="formError" class="text-xs text-rose-600 dark:text-rose-400">{{ formError }}</p>
					</div>
					<div class="flex flex-shrink-0 justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
						<CommonAppButton variant="secondary" @click="showForm = false">Hủy</CommonAppButton>
						<CommonAppButton :loading="submitting" @click="submit">Lập uỷ quyền</CommonAppButton>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>
