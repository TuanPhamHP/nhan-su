<script setup lang="ts">
	import { formatDateTime } from '~/utils/date';
	import { useProfileChangeService } from '~/services/profile-change.service';
	import type { ProfileChangeDetail, ProfileChangeField } from '~/types/hr-profile.types';

	/**
	 * Chi tiết một yêu cầu thay đổi thông tin nhân sự, cho người duyệt (UI-05, lô 3a).
	 *
	 * Bảng so ba cột: giá trị lúc nhân viên gửi, giá trị nhân viên đề nghị, và giá trị đang có
	 * trong hồ sơ. Dòng nào cột hiện tại khác cột lúc gửi nghĩa là có người sửa chen vào giữa;
	 * duyệt lúc đó sẽ bị máy chủ từ chối, nên dòng đó được tô cảnh báo và màn hình gợi ý từ
	 * chối để nhân viên gửi lại yêu cầu mới.
	 */
	const props = defineProps<{
		request: ProfileChangeDetail;
	}>();

	const emit = defineEmits<{
		/** Đã duyệt hoặc đã từ chối xong: trang ngoài tải lại danh sách và số badge. */
		decided: [];
		close: [];
	}>();

	const toast = useToast();
	const service = useProfileChangeService();

	const approving = ref(false);
	const rejecting = ref(false);
	const approveNote = ref('');
	const rejectNote = ref('');
	const showRejectForm = ref(false);
	const openingDocumentId = ref<number | null>(null);

	const isPending = computed(() => props.request.status === 'PENDING');

	/** Dòng có người sửa chen vào giữa lúc gửi và lúc duyệt. */
	function isStale(field: ProfileChangeField): boolean {
		return (field.current ?? null) !== (field.before ?? null);
	}

	const staleFields = computed(() => props.request.fields.filter(isStale));

	async function openDocument(documentId: number) {
		openingDocumentId.value = documentId;
		try {
			const url = await service.getDocumentUrl(props.request.id, documentId);
			window.open(url, '_blank');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa mở được giấy tờ kèm theo.');
		} finally {
			openingDocumentId.value = null;
		}
	}

	async function approve() {
		approving.value = true;
		try {
			await service.approve(props.request.id, approveNote.value.trim() || undefined);
			toast.success('Đã duyệt yêu cầu và cập nhật hồ sơ nhân viên.');
			emit('decided');
		} catch (e) {
			// Giữ hộp thoại mở và hiện nguyên câu của máy chủ: người duyệt cần đọc lại bảng ba cột
			// rồi chọn từ chối. Vài lỗi chỉ lộ ra đúng lúc duyệt chứ không có lúc nhân viên gửi:
			// số căn cước trùng người khác (409 `CITIZEN_ID_EXISTS`), luật thân nhân vỡ khi ghép
			// với bản ghi đang lưu (400 `EMPLOYEE_RELATIVE_INVALID`), và có người sửa chen vào
			// (409 `PROFILE_CHANGE_STALE`). Yêu cầu vẫn ở trạng thái chờ sau những lỗi này.
			toast.error(e instanceof Error ? e.message : 'Chưa duyệt được yêu cầu này.');
		} finally {
			approving.value = false;
		}
	}

	async function reject() {
		const note = rejectNote.value.trim();
		if (!note) {
			toast.error('Bạn ghi lý do từ chối để nhân viên biết cần sửa gì.');
			return;
		}
		rejecting.value = true;
		try {
			await service.reject(props.request.id, note);
			toast.success('Đã từ chối yêu cầu và gửi lý do cho nhân viên.');
			emit('decided');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa từ chối được yêu cầu này.');
		} finally {
			rejecting.value = false;
		}
	}

	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400';
	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
			@click.self="emit('close')"
		>
			<div
				class="my-8 w-full max-w-3xl rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
			>
				<!-- Đầu hộp thoại -->
				<div class="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-700">
					<div class="min-w-0">
						<h3 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ request.sectionLabel }} · {{ request.actionLabel }}
						</h3>
						<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
							{{ request.employee.fullName }} · {{ request.employee.employeeCode }}
							<template v-if="request.employee.departmentName"> · {{ request.employee.departmentName }}</template>
						</p>
						<p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
							Gửi lúc {{ formatDateTime(request.createdAt) }} · yêu cầu số {{ request.id }}
						</p>
					</div>
					<button
						type="button"
						class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="space-y-5 p-6">
					<!-- Cảnh báo BR-04 -->
					<div
						v-if="request.warnings.length"
						class="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20"
					>
						<p class="text-sm font-medium text-amber-800 dark:text-amber-200">Bạn rà lại trước khi duyệt</p>
						<ul class="mt-1 space-y-0.5">
							<li v-for="(w, i) in request.warnings" :key="i" class="text-xs text-amber-700 dark:text-amber-300">
								{{ w }}
							</li>
						</ul>
					</div>

					<!-- Có người sửa chen vào -->
					<div
						v-if="isPending && staleFields.length"
						class="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-900/20"
					>
						<p class="text-sm text-rose-800 dark:text-rose-200">
							Có {{ staleFields.length }} dòng đã được người khác sửa sau khi nhân viên gửi yêu cầu, nên hệ thống
							sẽ không cho duyệt. Bạn từ chối kèm lý do rồi nhờ nhân viên gửi lại yêu cầu mới.
						</p>
					</div>

					<!-- Bảng ba cột -->
					<div class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
										<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
											Thông tin
										</th>
										<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
											Lúc gửi
										</th>
										<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
											Đề nghị
										</th>
										<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
											Hiện tại
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
									<tr v-if="!request.fields.length">
										<td colspan="4" class="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
											Yêu cầu này không có dòng thông tin nào.
										</td>
									</tr>
									<tr
										v-for="field in request.fields"
										:key="field.key"
										:class="isStale(field) ? 'bg-rose-50/70 dark:bg-rose-900/20' : ''"
									>
										<td class="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{{ field.label }}</td>
										<td class="px-4 py-3 text-gray-600 dark:text-gray-400">{{ field.before ?? '—' }}</td>
										<td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ field.after ?? '—' }}</td>
										<td
											class="px-4 py-3"
											:class="
												isStale(field)
													? 'font-medium text-rose-700 dark:text-rose-300'
													: 'text-gray-600 dark:text-gray-400'
											"
										>
											{{ field.current ?? '—' }}
											<p v-if="isStale(field)" class="text-xs font-normal">Đã bị sửa sau khi gửi</p>
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>

					<!-- Giấy tờ kèm theo -->
					<div v-if="request.documents.length">
						<p class="mb-2 text-sm font-medium text-gray-800 dark:text-gray-100">Giấy tờ kèm theo</p>
						<ul class="space-y-2">
							<li
								v-for="doc in request.documents"
								:key="doc.id"
								class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
							>
								<div class="min-w-0">
									<p class="truncate text-sm text-gray-800 dark:text-gray-100">{{ doc.fileName }}</p>
									<p class="text-xs text-gray-400 dark:text-gray-500">
										{{ doc.typeLabel }} · tải lên {{ formatDateTime(doc.uploadedAt) }}
									</p>
								</div>
								<CommonAppButton
									size="sm"
									variant="outline"
									:loading="openingDocumentId === doc.id"
									@click="openDocument(doc.id)"
								>
									Mở
								</CommonAppButton>
							</li>
						</ul>
					</div>

					<!-- Kết quả nếu đã quyết -->
					<div
						v-if="!isPending"
						class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
					>
						<p class="text-sm text-gray-700 dark:text-gray-200">
							{{ request.statusLabel }}
							<template v-if="request.decidedBy"> bởi {{ request.decidedBy.name }}</template>
							<template v-if="request.decidedAt"> lúc {{ formatDateTime(request.decidedAt) }}</template>
						</p>
						<p v-if="request.decisionNote" class="mt-1 text-sm text-gray-600 dark:text-gray-300">
							Ghi chú: {{ request.decisionNote }}
						</p>
						<p v-if="request.cancelReason" class="mt-1 text-sm text-gray-600 dark:text-gray-300">
							{{ request.cancelReason }}
						</p>
					</div>

					<!-- Duyệt, từ chối -->
					<template v-if="isPending">
						<div v-if="!showRejectForm" class="space-y-3">
							<div>
								<label :class="labelCls">Ghi chú khi duyệt</label>
								<input v-model="approveNote" :class="[inputCls, 'mt-1']" placeholder="Không bắt buộc" />
							</div>
							<div class="flex flex-wrap justify-end gap-3">
								<CommonAppButton variant="outline" @click="emit('close')">Đóng</CommonAppButton>
								<CommonAppButton variant="danger_outline" @click="showRejectForm = true">Từ chối</CommonAppButton>
								<CommonAppButton :loading="approving" @click="approve">Duyệt</CommonAppButton>
							</div>
						</div>

						<div v-else class="space-y-3">
							<div>
								<label :class="labelCls">Lý do từ chối <span class="text-red-500">*</span></label>
								<textarea
									v-model="rejectNote"
									rows="3"
									:class="[inputCls, 'mt-1']"
									placeholder="Ví dụ Số tài khoản không khớp giấy tờ bạn gửi kèm"
								/>
								<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
									Nhân viên nhận được đúng câu này, nên bạn ghi rõ cần sửa gì.
								</p>
							</div>
							<div class="flex flex-wrap justify-end gap-3">
								<CommonAppButton variant="outline" @click="showRejectForm = false">Quay lại</CommonAppButton>
								<CommonAppButton variant="danger" :loading="rejecting" @click="reject">Từ chối yêu cầu</CommonAppButton>
							</div>
						</div>
					</template>

					<div v-else class="flex justify-end">
						<CommonAppButton variant="outline" @click="emit('close')">Đóng</CommonAppButton>
					</div>
				</div>
			</div>
		</div>
	</Teleport>
</template>
