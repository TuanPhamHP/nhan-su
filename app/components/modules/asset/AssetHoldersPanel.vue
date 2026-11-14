<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import ReturnModal from '~/components/modules/asset/ReturnModal.vue';
	import { CONFIRMATION_CLASS, assignmentEndText, assignmentHolderName } from '~/utils/asset.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { Asset, AssetAssignment } from '~/types/asset.types';

	const props = withDefaults(
		defineProps<{
			asset: Asset;
			canManage: boolean;
			/**
			 * Xin được biên bản PDF hay không. Tách khỏi `canManage` vì route biên bản vẫn chạy
			 * khi module ở chế độ chỉ xem, trong khi các nút ghi thì không.
			 */
			canHandoverPdf?: boolean;
		}>(),
		{ canHandoverPdf: false },
	);

	const emit = defineEmits<{ 'asset-changed': [] }>();

	const toast = useToast();
	const service = useAssetService();

	const assignments = ref<AssetAssignment[]>([]);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const returning = ref<AssetAssignment | null>(null);

	const isService = computed(() => props.asset.kind === 'SERVICE');
	const open = computed(() => assignments.value.filter(a => !a.returnedAt));
	const closed = computed(() => assignments.value.filter(a => a.returnedAt));

	/**
	 * Thu hồi tạm khoá khi tài sản đang chờ xác minh mất: BE trả 409 `ASSET_LOSS_REPORTED`
	 * và bảo xử lý báo mất trước, nên để nút ở đó chỉ dẫn người dùng vào lỗi.
	 */
	const canReturn = computed(() => props.canManage && props.asset.status !== 'LOSS_REPORTED');
	/** Biên bản chỉ có với thiết bị; ghế dịch vụ gọi vào là 400 `ASSET_NOT_PHYSICAL`. */
	const showHandover = computed(() => props.canHandoverPdf && !isService.value);

	const openingPdf = ref<string | null>(null);

	/**
	 * Tên nút biên bản của một lần cấp phát.
	 *
	 * Điều chuyển chỉ có MỘT biên bản `BBDC-…` cho cả hai bên: lần mới xin `kind=assign`, lần cũ
	 * xin `kind=return`, BE trả cùng một giấy tờ. Vì thế hai nút đó đều ghi "Biên bản điều
	 * chuyển" để người xem không tưởng có hai giấy khác nhau.
	 */
	function assignPdfLabel(a: AssetAssignment): string {
		return a.transferredFrom ? 'Biên bản điều chuyển' : 'Biên bản bàn giao';
	}
	function returnPdfLabel(a: AssetAssignment): string {
		return a.endReason === 'TRANSFERRED' ? 'Biên bản điều chuyển' : 'Biên bản thu hồi';
	}
	/** Lần cấp phát kết thúc vì mất thì không có biên bản thu hồi (409 `ASSET_ASSIGNMENT_LOST`). */
	function hasReturnPdf(a: AssetAssignment): boolean {
		return a.endReason !== 'LOST';
	}

	/**
	 * Lấy biên bản rồi mở ở tab mới.
	 *
	 * Lần đầu BE dựng PDF và lưu thành giấy tờ của lần cấp phát, lần sau trả lại đúng giấy
	 * tờ đó với link mới; link sống một giờ nên xin lúc bấm chứ không giữ lại.
	 */
	async function openHandoverPdf(assignment: AssetAssignment, kind: 'assign' | 'return') {
		const key = `${assignment.id}-${kind}`;
		if (openingPdf.value) return;
		openingPdf.value = key;
		try {
			const { url } = await service.handoverPdf(assignment.id, kind);
			window.open(url, '_blank', 'noopener');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa mở được biên bản. Bạn thử lại sau ít phút.');
		} finally {
			openingPdf.value = null;
		}
	}

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			assignments.value = await service.findAssignments(props.asset.id);
		} catch (e) {
			assignments.value = [];
			loadError.value =
				e instanceof Error ? e.message : 'Chưa tải được người dùng của tài sản này. Bạn bấm Thử lại.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	async function onReturned() {
		returning.value = null;
		await load();
		emit('asset-changed');
	}

	// ─── Trả lời người nhận báo chưa đúng ─────────────────────────────────────────

	const MAX_RESPONSE = 1000;
	const responding = ref<AssetAssignment | null>(null);
	const responseText = ref('');
	const responseError = ref('');
	const sendingResponse = ref(false);

	function startResponse(a: AssetAssignment) {
		responding.value = a;
		responseText.value = '';
		responseError.value = '';
	}

	function closeResponse() {
		if (sendingResponse.value) return;
		responding.value = null;
	}

	async function sendResponse() {
		const target = responding.value;
		if (!target || sendingResponse.value) return;
		const text = responseText.value.trim();
		if (!text) {
			responseError.value = 'Bạn nhập câu trả lời trước khi gửi, ví dụ đã bổ sung phụ kiện hay sẽ đổi máy khác.';
			return;
		}
		responseError.value = '';
		sendingResponse.value = true;
		const holder = assignmentHolderName(target);
		try {
			await service.respondToDispute(target.id, text);
			toast.success(
				`Đã gửi câu trả lời cho ${holder}. Cấp phát ${props.asset.code} về Chờ người nhận xác nhận và ${holder} sẽ nhận được thông báo để kiểm lại.`,
			);
			responding.value = null;
			await load();
			emit('asset-changed');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa gửi được câu trả lời. Bạn thử lại sau ít phút.');
			// Lần cấp phát đã đổi trạng thái ở nơi khác (đã có người trả lời, đã thu hồi): dữ liệu
			// đang xem đã cũ nên đóng hộp và tải lại. Lỗi khác giữ hộp để câu vừa gõ không mất.
			const code = (e as { data?: { error?: { code?: string } } }).data?.error?.code;
			if (code === 'ASSET_ASSIGNMENT_NOT_DISPUTED' || code === 'ASSET_ASSIGNMENT_CLOSED') {
				responding.value = null;
				await load();
			}
		} finally {
			sendingResponse.value = false;
		}
	}

	useEscapeKey(closeResponse, () => !!responding.value);
</script>

<template>
	<div class="space-y-5">
		<div v-if="loading" class="space-y-3">
			<div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-center dark:border-rose-800 dark:bg-rose-900/20"
		>
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
		</div>

		<template v-else>
			<section class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
				<div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
					<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">
						{{ isService ? 'Ghế đang dùng' : 'Đang giữ' }}
						<span class="ml-1 text-xs font-normal text-gray-500">{{ open.length }}</span>
					</h3>
					<p v-if="canManage && !canReturn" class="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
						Tài sản đang chờ xác minh mất nên chưa thu hồi hay điều chuyển được. Bạn xử lý báo mất ở tab Báo
						hỏng, báo mất trước.
					</p>
				</div>

				<p v-if="!open.length" class="px-4 py-10 text-center text-sm text-gray-600 dark:text-gray-400">
					<template v-if="isService">
						Dịch vụ chưa cấp ghế cho ai.<template v-if="canManage"> Bạn mở Tác vụ và chọn Cấp ghế.</template>
					</template>
					<template v-else>
						Tài sản đang chưa cấp phát cho ai.<template v-if="canManage"> Bạn mở Tác vụ và chọn Cấp phát.</template>
					</template>
				</p>

				<div v-else class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
							<tr>
								<th class="px-4 py-2 text-left font-medium">Người giữ</th>
								<th class="px-4 py-2 text-left font-medium">Ngày cấp phát</th>
								<th class="px-4 py-2 text-left font-medium">Người nhận xác nhận</th>
								<th v-if="!isService" class="px-4 py-2 text-left font-medium">Tình trạng khi cấp phát</th>
								<th v-if="canManage || showHandover" class="px-4 py-2" />
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-for="a in open" :key="a.id" class="align-top">
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ assignmentHolderName(a) }}</p>
									<p v-if="a.employee" class="font-mono text-xs text-gray-500">{{ a.employee.employeeCode }}</p>
									<p v-if="a.transferredFrom" class="text-xs text-gray-600 dark:text-gray-400">
										Nhận từ {{ a.transferredFrom.holderName }}
									</p>
									<p v-if="a.note" class="mt-1 max-w-xs break-words text-xs text-gray-600 dark:text-gray-400">
										Ghi chú: {{ a.note }}
									</p>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatDate(a.assignedAt) }}</td>
								<td class="max-w-xs px-4 py-3">
									<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="CONFIRMATION_CLASS[a.confirmation]">
										{{ a.confirmationLabel }}
									</span>
									<p v-if="a.confirmation === 'PENDING' && !a.disputeResponse" class="mt-1 text-xs text-gray-500">
										Người nhận bấm Đã nhận ở trang Tài sản của tôi.
									</p>
									<p v-if="a.disputeReason" class="mt-1 break-words text-xs text-rose-700 dark:text-rose-400">
										Người nhận báo: {{ a.disputeReason }}
									</p>
									<p v-if="a.disputeResponse" class="mt-1 break-words text-xs text-gray-700 dark:text-gray-300">
										Đã trả lời<template v-if="a.disputeRespondedAt"> lúc {{ formatDateTime(a.disputeRespondedAt) }}</template>:
										{{ a.disputeResponse }}
									</p>
								</td>
								<td v-if="!isService" class="px-4 py-3 text-gray-600 dark:text-gray-300">
									{{ a.conditionOnAssignLabel ?? 'Không ghi' }}
								</td>
								<td v-if="canManage || showHandover" class="px-4 py-3 text-right">
									<div class="flex flex-wrap justify-end gap-2">
										<CommonAppButton
											v-if="canManage && a.confirmation === 'DISPUTED'"
											size="sm"
											variant="primary"
											@click="startResponse(a)"
										>
											Trả lời
										</CommonAppButton>
										<CommonAppButton
											v-if="showHandover"
											size="sm"
											variant="outline"
											:loading="openingPdf === `${a.id}-assign`"
											@click="openHandoverPdf(a, 'assign')"
										>
											{{ assignPdfLabel(a) }}
										</CommonAppButton>
										<CommonAppButton v-if="canReturn" size="sm" variant="outline" @click="returning = a">
											Thu hồi
										</CommonAppButton>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</section>

			<section
				v-if="closed.length"
				class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
			>
				<h3 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
					Các lần cấp phát đã kết thúc
					<span class="ml-1 text-xs font-normal text-gray-500">{{ closed.length }}</span>
				</h3>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
							<tr>
								<th class="px-4 py-2 text-left font-medium">Người giữ</th>
								<th class="px-4 py-2 text-left font-medium">Từ ngày</th>
								<th class="px-4 py-2 text-left font-medium">Đến ngày</th>
								<th class="px-4 py-2 text-left font-medium">Kết thúc vì</th>
								<th v-if="!isService" class="px-4 py-2 text-left font-medium">Tình trạng khi thu hồi</th>
								<th class="px-4 py-2 text-left font-medium">Ghi chú</th>
								<th v-if="showHandover" class="px-4 py-2" />
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-for="a in closed" :key="a.id" class="align-top">
								<td class="px-4 py-3 text-gray-900 dark:text-white">
									{{ assignmentHolderName(a) }}
									<p v-if="a.transferredFrom" class="text-xs text-gray-600 dark:text-gray-400">
										Nhận từ {{ a.transferredFrom.holderName }}
									</p>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatDate(a.assignedAt) }}</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatDate(a.returnedAt) }}</td>
								<td class="px-4 py-3">
									<span
										class="text-sm"
										:class="a.endReason === 'LOST' ? 'font-medium text-rose-700 dark:text-rose-400' : 'text-gray-700 dark:text-gray-300'"
									>
										{{ assignmentEndText(a) }}
									</span>
								</td>
								<td v-if="!isService" class="px-4 py-3 text-gray-600 dark:text-gray-300">
									{{ a.conditionOnReturnLabel ?? 'Không ghi' }}
								</td>
								<td class="max-w-xs break-words px-4 py-3 text-gray-600 dark:text-gray-400">{{ a.returnNote ?? '—' }}</td>
								<td v-if="showHandover" class="px-4 py-3 text-right">
									<div class="flex flex-wrap justify-end gap-2">
										<CommonAppButton
											size="sm"
											variant="outline"
											:loading="openingPdf === `${a.id}-assign`"
											@click="openHandoverPdf(a, 'assign')"
										>
											{{ assignPdfLabel(a) }}
										</CommonAppButton>
										<CommonAppButton
											v-if="hasReturnPdf(a)"
											size="sm"
											variant="outline"
											:loading="openingPdf === `${a.id}-return`"
											@click="openHandoverPdf(a, 'return')"
										>
											{{ returnPdfLabel(a) }}
										</CommonAppButton>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</section>
		</template>

		<ReturnModal
			v-if="returning"
			:assignment="returning"
			@returned="onReturned"
			@close="returning = null"
		/>

		<!-- Trả lời người nhận báo chưa đúng -->
		<Teleport to="body">
			<div
				v-if="responding"
				class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
				role="dialog"
				aria-modal="true"
				aria-label="Trả lời người nhận"
			>
				<form class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900" @submit.prevent="sendResponse">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Trả lời người nhận</h2>
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
						{{ asset.code }} · {{ asset.name }}, cấp phát cho {{ assignmentHolderName(responding) }}.
					</p>
					<p
						v-if="responding.disputeReason"
						class="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
					>
						Người nhận báo: {{ responding.disputeReason }}
					</p>
					<div class="mt-4 space-y-1">
						<label for="dispute-response" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Câu trả lời <span class="text-red-500">*</span>
						</label>
						<textarea
							id="dispute-response"
							v-model="responseText"
							rows="3"
							:maxlength="MAX_RESPONSE"
							placeholder="VD: đã gửi bổ sung sạc qua tổ xe chiều nay"
							class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
						<p v-if="responseError" class="text-sm text-red-600">{{ responseError }}</p>
						<p v-else class="text-xs text-gray-600 dark:text-gray-400">
							Gửi xong, cấp phát về Chờ người nhận xác nhận và người nhận được báo để kiểm lại rồi bấm Đã nhận.
							Muốn đổi sang tài sản khác thì bạn thu hồi rồi cấp phát lại, không cần trả lời.
						</p>
					</div>
					<div class="mt-5 flex justify-end gap-3">
						<CommonAppButton variant="secondary" type="button" :disabled="sendingResponse" @click="closeResponse">
							Đóng
						</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="sendingResponse">
							Gửi câu trả lời
						</CommonAppButton>
					</div>
				</form>
			</div>
		</Teleport>
	</div>
</template>
