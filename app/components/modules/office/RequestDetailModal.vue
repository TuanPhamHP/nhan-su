<script setup lang="ts">
	import { useOfficeService } from '~/services/office.service';
	import {
		officeErrorCode,
		officeErrorMessage,
		officeMoney,
		supplyStatusLabel,
		supplyStatusMeta,
	} from '~/utils/office.utils';
	import { formatDateTime } from '~/utils/date';
	import type { SupplyRequest } from '~/types/office.types';

	/**
	 * Một phiếu của một phòng, nhìn từ phía HCNS: xem dòng, chốt số, cấp hàng và ghi đã giao thay.
	 *
	 * Số chốt mặc định bằng số xin, nên HCNS chỉ sửa những dòng thật sự cắt bớt. Sửa số thì phải
	 * ghi lý do — hộp này chặn ngay tại ô để người chốt không phải gửi lên rồi mới biết, nhưng vẫn
	 * nhận và hiện câu lỗi của máy chủ nếu lọt qua (dữ liệu cũ, hai người chốt cùng lúc).
	 */
	const props = defineProps<{
		requestId: number;
		/** Người xem có `office:supply:manage`, module còn ghi được, và kỳ chưa đóng. */
		canManage: boolean;
	}>();

	const emit = defineEmits<{
		/** Phiếu vừa đổi trạng thái, để trang kỳ tải lại bảng tổng hợp. */
		changed: [request: SupplyRequest];
		close: [];
	}>();

	const toast = useToast();
	const service = useOfficeService();

	const request = ref<SupplyRequest | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const working = ref(false);

	/** Số chốt và lý do đang sửa trên màn, theo `lineId`. */
	const finalQty = reactive<Record<number, number | undefined>>({});
	const finalNote = reactive<Record<number, string>>({});
	const customPrice = reactive<Record<number, number | undefined>>({});
	const lineErrors = reactive<Record<number, string>>({});

	/** Số thực nhận đang sửa (Q1), chỉ dùng ở bảng "Sửa số thực nhận". */
	const receivedQty = reactive<Record<number, number | undefined>>({});
	const receivedNote = reactive<Record<number, string>>({});
	const correctReason = ref('');
	const correctError = ref('');

	/**
	 * Hai bảng của cùng một phiếu: bảng số chốt (mặc định) và bảng số thực nhận.
	 *
	 * Tách hai bảng vì chúng trả lời hai câu khác nhau — "HCNS cấp bao nhiêu" và "phòng nhận được
	 * bao nhiêu" — và mỗi bảng gửi lên một route riêng với luật riêng.
	 */
	const panel = ref<'final' | 'received'>('final');

	const receiverName = ref('');
	const showDeliverForm = ref(false);

	function fillForm(data: SupplyRequest) {
		request.value = data;
		for (const line of data.lines) {
			finalQty[line.id] = line.finalQty ?? line.requestedQty;
			finalNote[line.id] = line.finalNote ?? '';
			customPrice[line.id] = line.unitPrice ?? undefined;
			receivedQty[line.id] = line.receivedQty ?? line.finalQty ?? undefined;
			receivedNote[line.id] = line.receivedNote ?? '';
			delete lineErrors[line.id];
		}
		correctReason.value = '';
		correctError.value = '';
	}

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			fillForm(await service.findRequest(props.requestId));
		} catch (e) {
			request.value = null;
			loadError.value = officeErrorMessage(e, 'Chưa mở được phiếu này. Bạn đóng hộp rồi thử lại.');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	useEscapeKey(
		() => emit('close'),
		() => !working.value,
	);

	/** Chốt lần đầu: kỳ đã khoá và phiếu chưa chốt. */
	const canFinalize = computed(() => props.canManage && request.value?.status === 'LOCKED');

	/**
	 * Chốt LẠI phiếu đã chốt, đã cấp, đã nhận cho tới khi đóng kỳ (Q1).
	 *
	 * Trang cha chỉ truyền `canManage=true` khi kỳ chưa đóng, nên ở đây không phải xét lại trạng
	 * thái kỳ: kỳ đóng rồi thì mọi nút sửa biến mất cùng lúc.
	 */
	const canRefinalize = computed(
		() =>
			props.canManage &&
			!!request.value &&
			['FINALIZED', 'ISSUED', 'RECEIVED'].includes(request.value.status) &&
			request.value.lines.length > 0,
	);

	/** Sửa số thực nhận: chỉ phiếu đã nhận. */
	const canCorrectReceived = computed(() => props.canManage && request.value?.status === 'RECEIVED');

	const canIssue = computed(() => props.canManage && request.value?.status === 'FINALIZED');

	/** Số chốt đang có của một dòng, dùng làm mốc để biết người dùng có đổi số hay không. */
	function baselineQty(line: SupplyRequest['lines'][number]): number {
		return line.finalQty ?? line.requestedQty;
	}

	type Line = SupplyRequest['lines'][number];

	/** Đang ở chế độ nhập số chốt: thành tiền phải tính ngay trên màn, không chờ lưu. */
	const editingFinal = computed(() => canFinalize.value || canRefinalize.value);

	/** Đơn giá dùng để tính: dòng ngoài danh mục lấy giá đang gõ, dòng danh mục lấy giá của kỳ. */
	function effectivePrice(line: Line): number | null {
		if (line.isCustom) return customPrice[line.id] ?? line.unitPrice ?? null;
		return line.unitPrice ?? null;
	}

	/**
	 * Thành tiền của một dòng theo số đang gõ.
	 *
	 * Trong lúc chốt, cột Thành tiền và dòng Tổng tiền phải chạy theo số HCNS vừa sửa: con số cũ
	 * của máy chủ đứng im làm người chốt tưởng cắt số rồi mà tiền không giảm, nên họ lưu đi lưu
	 * lại để kiểm tra.
	 */
	function lineAmount(line: Line): number | null {
		// PHÒNG ĐÃ NHẬN thì tiền đi theo SỐ THỰC NHẬN, lấy thẳng `amount` của máy chủ.
		//
		// Hộp này sửa số chốt, nhưng sau khi phòng nhận hàng thì số chốt không còn là số dùng để
		// tính tiền nữa: báo cáo chi phí và trang của phòng đều tính theo số thực nhận. Tính lại
		// theo số chốt ở đây làm hộp của HCNS ghi 586.000 trong khi hai chỗ kia ghi 581.000, và
		// người đọc không có cách nào biết con số nào là tiền thật.
		if (line.receivedQty != null) return line.amount;
		if (!editingFinal.value) return line.amount;
		const qty = finalQty[line.id];
		const price = effectivePrice(line);
		if (qty == null || price == null) return null;
		return qty * price;
	}

	const totalAmount = computed(() => {
		const data = request.value;
		if (!data) return null;
		if (!editingFinal.value) return data.totalAmount;
		let sum = 0;
		for (const line of data.lines) sum += lineAmount(line) ?? 0;
		return sum;
	});

	/** Dòng chưa có đơn giá nên không vào tổng tiền: nói ra để người chốt không tưởng tổng đã đủ. */
	const unpricedLines = computed(() => {
		const data = request.value;
		if (!data) return 0;
		return data.lines.filter(line => effectivePrice(line) == null && (finalQty[line.id] ?? 0) > 0).length;
	});

	/** Phiếu đã nhận: nói rõ tiền đang tính theo số nào, để không ai so lệch với số chốt. */
	const amountBasis = computed(() => {
		const data = request.value;
		if (!data) return '';
		return data.lines.some(line => line.receivedQty != null)
			? 'Thành tiền tính theo số phòng thực nhận.'
			: '';
	});

	/** Dòng có số thực nhận hoặc ghi chú khác lúc mở hộp: chỉ những dòng này được gửi lên (F-58). */
	function receivedChanged(line: Line): boolean {
		const qty = receivedQty[line.id];
		const note = receivedNote[line.id]?.trim() ?? '';
		return qty !== (line.receivedQty ?? undefined) || note !== (line.receivedNote ?? '').trim();
	}

	/**
	 * Dòng vừa đổi số mà ghi chú cũ còn nguyên.
	 *
	 * Ghi chú "thiếu 2" nằm lại trên một dòng vừa sửa thành nhận đủ là thông tin sai, mà nó đi vào
	 * cả cột Ghi chú của bảng tổng hợp lẫn thông báo gửi cho phòng.
	 */
	function noteNeedsUpdate(line: Line): boolean {
		const qty = receivedQty[line.id];
		const note = receivedNote[line.id]?.trim() ?? '';
		return qty !== (line.receivedQty ?? undefined) && !!note && note === (line.receivedNote ?? '').trim();
	}

	/**
	 * Ghi đã giao thay chỉ hiện sau `proxyAllowedAt` (ba ngày làm việc kể từ lúc cấp). Trước mốc
	 * đó nút không hiện, đúng như máy chủ chặn bằng `OFFICE_SUPPLY_PROXY_TOO_EARLY`.
	 */
	const canMarkDelivered = computed(() => {
		const data = request.value;
		if (!props.canManage || !data || data.status !== 'ISSUED' || !data.proxyAllowedAt) return false;
		return new Date(data.proxyAllowedAt).getTime() <= Date.now();
	});

	const proxyWaitNote = computed(() => {
		const data = request.value;
		if (!props.canManage || !data || data.status !== 'ISSUED' || canMarkDelivered.value) return '';
		if (!data.proxyAllowedAt) return 'Phòng nhận hàng rồi bấm Đã nhận trên phiếu của họ.';
		return `Bạn ghi đã giao thay được từ ${formatDateTime(data.proxyAllowedAt)}, nếu đến lúc đó phòng vẫn chưa bấm Đã nhận.`;
	});

	/**
	 * Dòng sửa số mà chưa ghi lý do: chặn ngay tại ô, kèm đúng câu máy chủ sẽ nói.
	 *
	 * Mốc so sánh là số ĐANG CÓ: lần chốt đầu là số phòng xin, còn lần chốt lại là số đã chốt
	 * trước đó, vì lúc đó người chốt đang sửa lại chính quyết định của mình.
	 */
	function validateFinalize(): boolean {
		const data = request.value;
		if (!data) return false;
		let ok = true;
		for (const line of data.lines) {
			delete lineErrors[line.id];
			const qty = finalQty[line.id];
			if (qty == null) {
				lineErrors[line.id] = 'Bạn nhập số chốt cho dòng này, nhập 0 nếu bỏ dòng.';
				ok = false;
				continue;
			}
			if (qty !== baselineQty(line) && !finalNote[line.id]?.trim()) {
				lineErrors[line.id] =
					line.finalQty == null ? 'Số chốt khác số xin thì bạn ghi lý do.' : 'Sửa số đã chốt thì bạn ghi lý do.';
				ok = false;
			}
			if (line.receivedQty != null && qty != null && qty < line.receivedQty) {
				lineErrors[line.id] = `Số chốt không được nhỏ hơn số phòng đã nhận là ${line.receivedQty}.`;
				ok = false;
			}
		}
		return ok;
	}

	async function finalize() {
		const data = request.value;
		if (!data || working.value) return;
		if (!validateFinalize()) {
			toast.warning('Bạn ghi lý do cho những dòng có số chốt khác số đang có.');
			return;
		}
		working.value = true;
		try {
			const updated = await service.finalizeRequest(data.id, {
				// Mỗi `lineId` gửi đúng một lần, kể cả dòng không đổi: máy chủ từ chối dòng trùng.
				lines: data.lines.map(line => ({
					lineId: line.id,
					finalQty: finalQty[line.id] as number,
					finalNote: finalNote[line.id]?.trim() || undefined,
					// Dòng ngoài danh mục không có đơn giá trong danh mục, nên giá nhập ở bước chốt.
					customUnitPrice: line.isCustom ? customPrice[line.id] : undefined,
				})),
			});
			const refinalize = data.status !== 'LOCKED';
			fillForm(updated);
			toast.success(
				refinalize
					? `Đã sửa số của phiếu phòng ${updated.department.name}. Trưởng phòng và đầu mối vừa nhận thông báo.`
					: `Đã chốt phiếu của phòng ${updated.department.name}.`,
			);
			emit('changed', updated);
		} catch (e) {
			if (officeErrorCode(e) === 'OFFICE_SUPPLY_FINAL_NOTE_REQUIRED') {
				validateFinalize();
			}
			toast.error(officeErrorMessage(e, 'Chưa lưu được số chốt. Bạn thử lại sau ít phút.'));
		} finally {
			working.value = false;
		}
	}

	/** Sửa số thực nhận của phiếu đã nhận; lý do là bắt buộc vì nó sửa số phòng đã xác nhận (Q1). */
	async function correctReceived() {
		const data = request.value;
		if (!data || working.value) return;
		correctError.value = '';
		if (!correctReason.value.trim()) {
			correctError.value = 'Bạn ghi lý do sửa số thực nhận.';
			return;
		}
		let ok = true;
		for (const line of data.lines) {
			delete lineErrors[line.id];
			const qty = receivedQty[line.id];
			const max = line.finalQty ?? 0;
			if (qty == null) {
				lineErrors[line.id] = 'Bạn nhập số thực nhận của dòng này.';
				ok = false;
			} else if (qty > max) {
				lineErrors[line.id] = `Số nhận không được lớn hơn số đã chốt là ${max}.`;
				ok = false;
			}
		}
		if (!ok) return;

		// Chỉ gửi dòng đã đổi: gửi cả phiếu thì thông báo cho phòng ghi "sửa ở 12 dòng" dù HCNS chỉ
		// sửa một dòng, và máy chủ cũng chỉ đếm dòng thật sự đổi.
		const changed = data.lines.filter(receivedChanged);
		if (!changed.length) {
			correctError.value = 'Bạn chưa đổi số thực nhận hay ghi chú nào, nên chưa có gì để lưu.';
			return;
		}

		working.value = true;
		try {
			const updated = await service.correctReceived(data.id, {
				reason: correctReason.value.trim(),
				lines: changed.map(line => ({
					lineId: line.id,
					receivedQty: receivedQty[line.id] as number,
					receivedNote: receivedNote[line.id]?.trim() || undefined,
				})),
			});
			const count = changed.length;
			fillForm(updated);
			panel.value = 'final';
			toast.success(
				`Đã sửa số thực nhận ở ${count} dòng của phiếu phòng ${updated.department.name}. Trưởng phòng và đầu mối vừa nhận thông báo.`,
			);
			emit('changed', updated);
		} catch (e) {
			// Máy chủ cũng đếm dòng đổi, nên câu "không có gì thay đổi" của nó thuộc về hộp này.
			if (officeErrorCode(e) === 'OFFICE_SUPPLY_NOTHING_CHANGED') {
				correctError.value = officeErrorMessage(e, 'Không có dòng nào đổi số hay ghi chú.');
			} else {
				toast.error(officeErrorMessage(e, 'Chưa sửa được số thực nhận. Bạn thử lại sau ít phút.'));
			}
		} finally {
			working.value = false;
		}
	}

	async function issue() {
		const data = request.value;
		if (!data || working.value) return;
		working.value = true;
		try {
			const updated = await service.issueRequest(data.id);
			fillForm(updated);
			toast.success(`Đã cấp hàng cho phòng ${updated.department.name}. Trưởng phòng và đầu mối vừa nhận thông báo.`);
			emit('changed', updated);
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa cấp được hàng. Bạn thử lại sau ít phút.'));
		} finally {
			working.value = false;
		}
	}

	async function markDelivered() {
		const data = request.value;
		if (!data || !receiverName.value.trim() || working.value) return;
		working.value = true;
		try {
			const updated = await service.markDelivered(data.id, { receiverName: receiverName.value.trim() });
			fillForm(updated);
			showDeliverForm.value = false;
			receiverName.value = '';
			toast.success(`Đã ghi ${updated.receiverName} nhận hàng của phòng ${updated.department.name}.`);
			emit('changed', updated);
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa ghi được đã giao. Bạn thử lại sau ít phút.'));
		} finally {
			working.value = false;
		}
	}

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-label="Chi tiết phiếu văn phòng phẩm"
		>
			<div class="my-4 w-full max-w-5xl rounded-2xl bg-white shadow-xl sm:my-8 dark:bg-gray-900">
				<div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ request ? `Phiếu phòng ${request.department.name}` : 'Phiếu văn phòng phẩm' }}
						</h2>
						<p v-if="request" class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
							{{ request.period.title }} · {{ request.isSupplement ? `phiếu bổ sung lần ${request.sequence}` : 'phiếu chính' }}
						</p>
					</div>
					<div class="flex items-center gap-2">
						<span
							v-if="request"
							:class="['inline-flex rounded-full px-2.5 py-1 text-xs font-medium', supplyStatusMeta(request.status).class]"
						>
							{{ supplyStatusLabel(request.status, request.lines.length) }}
						</span>
						<button
							type="button"
							class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:h-8 sm:w-8 dark:hover:bg-gray-800 dark:hover:text-gray-300"
							aria-label="Đóng phiếu"
							@click="emit('close')"
						>
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>

				<div class="p-4 sm:p-6">
					<div v-if="loading" class="space-y-3">
						<div v-for="i in 4" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
					</div>

					<div
						v-else-if="loadError"
						class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
					>
						{{ loadError }}
					</div>

					<template v-else-if="request">
						<p v-if="request.note" class="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
							Ghi chú phiếu: {{ request.note }}
						</p>

						<p v-if="!request.lines.length" class="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
							Phòng này chưa nhập dòng nào.
						</p>

						<!-- Bảng sửa số thực nhận: chỉ mở khi người chốt chủ động bấm, để không nhầm với số chốt. -->
						<div v-else-if="panel === 'received'" class="space-y-4">
							<p class="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
								Sửa lại số phòng thực nhận khi phòng bấm nhầm. Phòng và đầu mối sẽ nhận thông báo kèm lý do bạn ghi.
							</p>
							<!-- Điện thoại: mỗi mặt hàng một khối dọc, như hộp xác nhận đã nhận của phòng. -->
							<div class="space-y-3 sm:hidden">
								<div v-for="line in request.lines" :key="line.id" class="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
									<p class="font-medium text-gray-900 dark:text-white">{{ line.name }}</p>
									<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
										Đơn vị {{ line.unit || '—' }} · đã chốt {{ line.finalQty != null ? line.finalQty : '—' }}
									</p>
									<div class="mt-3 space-y-1">
										<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Thực nhận</label>
										<UiNumberInput
											v-model="receivedQty[line.id]"
											:min="0"
											:max="line.finalQty ?? 0"
											:error="lineErrors[line.id]"
											:aria-label="`Số thực nhận của ${line.name}`"
										/>
									</div>
									<div class="mt-3 space-y-1">
										<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Ghi chú</label>
										<input v-model="receivedNote[line.id]" type="text" maxlength="500" :class="inputCls" />
										<p v-if="noteNeedsUpdate(line)" class="text-xs text-amber-600 dark:text-amber-400">
											Số đã đổi, bạn sửa ghi chú này cho khớp.
										</p>
									</div>
								</div>
							</div>

							<div class="hidden overflow-x-auto sm:block">
								<table class="w-full min-w-[560px] text-sm">
									<thead>
										<tr class="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
											<th class="px-2 py-2">Mặt hàng</th>
											<th class="px-2 py-2 text-right">Đã chốt</th>
											<th class="px-2 py-2 text-right">Thực nhận</th>
											<th class="px-2 py-2">Ghi chú</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
										<tr v-for="line in request.lines" :key="line.id">
											<td class="px-2 py-2 text-gray-900 dark:text-white">{{ line.name }}</td>
											<td class="px-2 py-2 text-right text-gray-700 dark:text-gray-200">
												{{ line.finalQty != null ? line.finalQty : '—' }}
											</td>
											<td class="px-2 py-2 text-right">
												<UiNumberInput
													v-model="receivedQty[line.id]"
													:min="0"
													:max="line.finalQty ?? 0"
													:input-class="`${inputCls} text-right`"
												/>
												<p v-if="lineErrors[line.id]" class="mt-1 text-left text-xs text-red-500">
													{{ lineErrors[line.id] }}
												</p>
											</td>
											<td class="px-2 py-2">
												<input v-model="receivedNote[line.id]" type="text" maxlength="500" :class="inputCls" />
												<p v-if="noteNeedsUpdate(line)" class="mt-1 text-xs text-amber-600 dark:text-amber-400">
													Số đã đổi, bạn sửa ghi chú này cho khớp.
												</p>
											</td>
										</tr>
									</tbody>
								</table>
							</div>
							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									Lý do sửa <span class="text-red-500">*</span>
								</label>
								<input
									v-model="correctReason"
									type="text"
									maxlength="500"
									:class="inputCls"
									placeholder="VD: Phòng gõ nhầm 2 thành 8"
									@input="correctError = ''"
								/>
								<p v-if="correctError" class="text-xs text-red-500">{{ correctError }}</p>
							</div>
						</div>

						<!--
							Điện thoại: bảng bảy cột không vừa màn 390 pixel, nên mỗi mặt hàng là một khối dọc.
							HCNS chốt phiếu ngay tại kho bằng điện thoại, không phải lúc nào cũng ngồi máy tính.
						-->
						<div v-else-if="request.lines.length" class="space-y-3 sm:hidden">
							<div v-for="line in request.lines" :key="line.id" class="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
								<p class="font-medium text-gray-900 dark:text-white">{{ line.name }}</p>
								<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
									{{ line.groupName || 'Ngoài danh mục' }} · đơn vị {{ line.unit || '—' }}
								</p>
								<p class="mt-1 text-xs text-gray-600 dark:text-gray-300">
									Phòng xin {{ line.requestedQty }}
									<template v-if="line.quota != null"> · định mức {{ line.quota }} {{ line.unit }}</template>
								</p>
								<p v-if="line.overQuota" class="text-xs text-amber-600 dark:text-amber-400">
									Vượt định mức: {{ line.overQuotaReason || 'không ghi lý do' }}
								</p>
								<p v-if="line.note" class="text-xs text-gray-500 dark:text-gray-400">Ghi chú phòng: {{ line.note }}</p>

								<div class="mt-3 space-y-1">
									<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Số chốt</label>
									<UiNumberInput
										v-if="editingFinal"
										v-model="finalQty[line.id]"
										:min="0"
										:max="100000"
										:error="lineErrors[line.id]"
										:aria-label="`Số chốt của ${line.name}`"
									/>
									<p v-else class="text-sm text-gray-900 dark:text-white">
										{{ line.finalQty != null ? line.finalQty : '—' }}
									</p>
								</div>
								<div v-if="editingFinal" class="mt-3 space-y-1">
									<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Lý do sửa số</label>
									<input v-model="finalNote[line.id]" type="text" maxlength="500" :class="inputCls" />
								</div>
								<div v-if="editingFinal && line.isCustom" class="mt-3 space-y-1">
									<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
										Đơn giá mặt hàng ngoài danh mục
									</label>
									<UiNumberInput v-model="customPrice[line.id]" :min="0" :max="1000000000" />
								</div>
								<p v-if="line.receivedQty != null" class="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
									Đã nhận {{ line.receivedQty }}
									<template v-if="line.receivedNote"> · {{ line.receivedNote }}</template>
								</p>
								<p class="mt-2 text-sm text-gray-900 dark:text-white">
									Thành tiền <span class="font-medium">{{ officeMoney(lineAmount(line)) }}</span>
								</p>
							</div>

							<div class="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
								<p class="font-medium text-gray-700 dark:text-gray-200">Tổng tiền phiếu</p>
								<p class="font-semibold text-gray-900 dark:text-white">{{ officeMoney(totalAmount) }}</p>
							</div>
							<p v-if="amountBasis" class="text-xs text-gray-500 dark:text-gray-400">{{ amountBasis }}</p>
							<p v-if="unpricedLines > 0" class="text-xs text-amber-600 dark:text-amber-400">
								{{ unpricedLines }} mặt hàng chưa có đơn giá nên chưa vào tổng tiền.
							</p>
						</div>

						<div v-if="request.lines.length && panel !== 'received'" class="hidden overflow-x-auto sm:block">
							<table class="w-full min-w-[720px] text-sm">
								<thead>
									<tr class="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
										<th class="px-2 py-2">Mặt hàng</th>
										<th class="px-2 py-2">ĐVT</th>
										<th class="px-2 py-2 text-right">Số xin</th>
										<th class="px-2 py-2 text-right">Định mức</th>
										<th class="px-2 py-2 text-right">Số chốt</th>
										<th class="px-2 py-2">Lý do sửa số</th>
										<th class="px-2 py-2 text-right">Thành tiền</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
									<tr v-for="line in request.lines" :key="line.id">
										<td class="px-2 py-2">
											<p class="font-medium text-gray-900 dark:text-white">{{ line.name }}</p>
											<p class="text-xs text-gray-500 dark:text-gray-400">
												{{ line.groupName || 'Ngoài danh mục' }}
												<template v-if="line.note"> · {{ line.note }}</template>
											</p>
											<p v-if="line.overQuota" class="text-xs text-amber-600 dark:text-amber-400">
												Vượt định mức: {{ line.overQuotaReason || 'không ghi lý do' }}
											</p>
										</td>
										<td class="px-2 py-2 text-gray-600 dark:text-gray-300">{{ line.unit || '—' }}</td>
										<td class="px-2 py-2 text-right text-gray-900 dark:text-white">{{ line.requestedQty }}</td>
										<td class="px-2 py-2 text-right text-gray-600 dark:text-gray-300">
											{{ line.quota != null ? line.quota : '—' }}
										</td>
										<td class="px-2 py-2 text-right">
											<UiNumberInput
												v-if="canFinalize || canRefinalize"
												v-model="finalQty[line.id]"
												:min="0"
												:max="100000"
												:input-class="`${inputCls} text-right`"
											/>
											<span v-else class="text-gray-900 dark:text-white">
												{{ line.finalQty != null ? line.finalQty : '—' }}
											</span>
											<p v-if="lineErrors[line.id]" class="mt-1 text-left text-xs text-red-500">
												{{ lineErrors[line.id] }}
											</p>
											<p v-if="line.receivedQty != null" class="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
												Đã nhận {{ line.receivedQty }}
												<template v-if="line.receivedNote"> · {{ line.receivedNote }}</template>
											</p>
										</td>
										<td class="px-2 py-2">
											<input
												v-if="canFinalize || canRefinalize"
												v-model="finalNote[line.id]"
												type="text"
												maxlength="500"
												:class="inputCls"
											/>
											<span v-else class="text-gray-600 dark:text-gray-300">{{ line.finalNote || '—' }}</span>
											<div v-if="(canFinalize || canRefinalize) && line.isCustom" class="mt-1">
												<UiNumberInput
													v-model="customPrice[line.id]"
													:min="0"
													:max="1000000000"
													:input-class="inputCls"
													placeholder="Đơn giá dòng ngoài danh mục"
												/>
											</div>
										</td>
										<!-- Thành tiền theo số ĐANG GÕ khi đang chốt, xem ghi chú ở `lineAmount`. -->
										<td class="px-2 py-2 text-right text-gray-900 dark:text-white">{{ officeMoney(lineAmount(line)) }}</td>
									</tr>
								</tbody>
								<tfoot>
									<tr class="border-t border-gray-200 dark:border-gray-700">
										<td class="px-2 py-2 font-medium text-gray-700 dark:text-gray-200" colspan="6">
											Tổng tiền phiếu
											<span v-if="amountBasis" class="text-xs font-normal text-gray-500 dark:text-gray-400">
												· {{ amountBasis }}
											</span>
											<span v-if="unpricedLines > 0" class="text-xs font-normal text-amber-600 dark:text-amber-400">
												· {{ unpricedLines }} mặt hàng chưa có đơn giá nên chưa vào tổng
											</span>
										</td>
										<td class="px-2 py-2 text-right font-semibold text-gray-900 dark:text-white">
											{{ officeMoney(totalAmount) }}
										</td>
									</tr>
								</tfoot>
							</table>
						</div>

						<div class="mt-4 space-y-1 text-xs text-gray-500 dark:text-gray-400">
							<p v-if="request.finalizedBy">
								Chốt bởi {{ request.finalizedBy.fullName }} lúc {{ formatDateTime(request.finalizedAt) }}.
							</p>
							<p v-if="request.issuedBy">
								Cấp bởi {{ request.issuedBy.fullName }} lúc {{ formatDateTime(request.issuedAt) }}.
							</p>
							<p v-if="request.receivedAt">
								{{ request.receivedByProxy ? 'Ghi đã giao' : 'Đã nhận' }} lúc
								{{ formatDateTime(request.receivedAt) }}
								<template v-if="request.receiverName"> bởi {{ request.receiverName }}</template>
								<template v-else-if="request.receivedBy"> bởi {{ request.receivedBy.fullName }}</template>.
							</p>
							<p v-if="proxyWaitNote">{{ proxyWaitNote }}</p>
						</div>

						<div v-if="showDeliverForm" class="mt-4 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Tên người nhận hàng <span class="text-red-500">*</span>
							</label>
							<input v-model="receiverName" type="text" maxlength="200" :class="`${inputCls} mt-1 max-w-sm`" placeholder="VD: Nguyễn Thị Huyền" />
							<div class="mt-3 flex gap-3">
								<CommonAppButton variant="secondary" size="sm" @click="showDeliverForm = false">Thôi</CommonAppButton>
								<CommonAppButton variant="primary" size="sm" :disabled="!receiverName.trim()" :loading="working" @click="markDelivered">
									Ghi đã giao
								</CommonAppButton>
							</div>
						</div>

						<div class="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
							<CommonAppButton variant="secondary" class="min-h-11 sm:min-h-0" @click="emit('close')">Đóng</CommonAppButton>

							<template v-if="panel === 'received'">
								<CommonAppButton variant="secondary" class="min-h-11 sm:min-h-0" @click="panel = 'final'">
									Quay lại số chốt
								</CommonAppButton>
								<CommonAppButton variant="primary" class="min-h-11 sm:min-h-0" :loading="working" @click="correctReceived">
									Lưu số thực nhận
								</CommonAppButton>
							</template>

							<template v-else>
								<CommonAppButton v-if="canFinalize" variant="primary" class="min-h-11 sm:min-h-0" :loading="working" @click="finalize">
									Chốt phiếu
								</CommonAppButton>
								<CommonAppButton v-if="canRefinalize" variant="primary" class="min-h-11 sm:min-h-0" :loading="working" @click="finalize">
									Sửa số
								</CommonAppButton>
								<CommonAppButton
									v-if="canCorrectReceived"
									variant="outline"
									class="min-h-11 sm:min-h-0"
									@click="panel = 'received'"
								>
									Sửa số thực nhận
								</CommonAppButton>
								<CommonAppButton v-if="canIssue" variant="primary" class="min-h-11 sm:min-h-0" :loading="working" @click="issue">
									Cấp hàng
								</CommonAppButton>
								<CommonAppButton
									v-if="canMarkDelivered && !showDeliverForm"
									variant="outline"
									class="min-h-11 sm:min-h-0"
									@click="showDeliverForm = true"
								>
									Ghi đã giao thay
								</CommonAppButton>
							</template>
						</div>
					</template>
				</div>
			</div>
		</div>
	</Teleport>
</template>
