<script setup lang="ts">
	import EmployeePicker, { type PickablePerson } from '~/components/modules/general-request/EmployeePicker.vue';
	import { useGeneralRequestService } from '~/services/general-request.service';
	import { apiErrorCode } from '~/utils/asset.utils';
	import type {
		GeneralRequestDetail,
		OverrideDecision,
		RequestStep,
	} from '~/types/general-request.types';

	/**
	 * Một hộp thoại cho mọi quyết định trên phiếu: đồng ý, từ chối, trả lại, chuyển lượt, duyệt
	 * thay, đổi người duyệt.
	 *
	 * Gom vào một chỗ vì sáu việc này chỉ khác nhau ở ô nhập và câu nhắc, còn phần khó thì giống
	 * hệt nhau: gửi kèm `stepOrder` của bước đang hiện trên màn, và xử lý lúc hai người bấm cùng
	 * lúc. Tách thành sáu hộp thoại là sao chép phần khó sáu lần.
	 *
	 * `stepOrder` là chốt chống bấm trượt: màn hình có thể đang hiện bước cũ trong khi người khác
	 * vừa duyệt xong bước đó. Máy chủ so `stepOrder` với bước hiện tại, lệch thì trả 409
	 * `REQUEST_NOT_PENDING` và cú bấm không rơi sang bước mới. Gặp 409 thì phát `conflict` để
	 * trang tải lại phiếu.
	 */
	export type RequestActionKind = 'approve' | 'reject' | 'return' | 'transfer' | 'override' | 'reassign';

	const props = defineProps<{
		kind: RequestActionKind;
		request: GeneralRequestDetail;
		/** Danh bạ để chọn người nhận lượt duyệt. */
		people: PickablePerson[];
	}>();

	const emit = defineEmits<{
		updated: [request: GeneralRequestDetail];
		conflict: [];
		close: [];
	}>();

	const toast = useToast();
	const service = useGeneralRequestService();

	const note = ref('');
	const decision = ref<OverrideDecision>('APPROVE');
	const target = ref<number[]>([]);
	const fromEmployeeId = ref<number | undefined>(undefined);
	const submitting = ref(false);
	const error = ref<string | null>(null);

	/**
	 * Việc của quản trị viên gọi là "quyết định thay", không gọi là "duyệt thay".
	 *
	 * "Duyệt thay" đã mang nghĩa khác trong lô này: người nhận uỷ quyền giữ lượt hộ người vắng,
	 * và phiếu ghi "duyệt thay Đỗ Thị Lan". Dùng cùng một chữ cho hai việc khác nhau về quyền
	 * khiến người đọc nhật ký không biết ai đã làm gì. Hộp thoại này còn có cả ba lựa chọn đồng
	 * ý, từ chối và trả lại, nên chữ "duyệt" cũng không đúng với hai lựa chọn sau.
	 */
	const TITLES: Record<RequestActionKind, string> = {
		approve: 'Đồng ý phiếu',
		reject: 'Từ chối phiếu',
		return: 'Trả lại để bổ sung',
		transfer: 'Chuyển lượt duyệt',
		override: 'Quyết định thay',
		reassign: 'Đổi người duyệt',
	};

	const INTROS: Record<RequestActionKind, string> = {
		approve: 'Phiếu sẽ đi tiếp sang bước sau, hoặc hoàn tất nếu đây là bước cuối.',
		reject: 'Phiếu dừng lại ở đây và người gửi nhận thông báo kèm lý do, nên lý do là bắt buộc.',
		return: 'Phiếu chuyển về trạng thái cần bổ sung để người gửi sửa rồi nộp lại, vì vậy bạn ghi rõ những gì cần bổ sung.',
		transfer:
			'Lượt duyệt của bạn chuyển sang người khác. Bạn không chuyển được cho người gửi phiếu, cũng không chuyển cho chính mình.',
		override: 'Bạn quyết định thay người đang giữ lượt. Việc này được ghi vào nhật ký nên lý do là bắt buộc.',
		reassign:
			'Việc này đổi người duyệt ở mọi bước còn đang mở của phiếu, và bạn dùng khi người đang giữ lượt không xử lý được.',
	};

	const NOTE_LABELS: Record<RequestActionKind, string> = {
		approve: 'Ghi chú khi duyệt',
		reject: 'Lý do từ chối',
		return: 'Nội dung cần bổ sung',
		transfer: 'Ghi chú cho người nhận',
		override: 'Lý do quyết định thay',
		reassign: 'Lý do đổi người duyệt',
	};

	/** Nút gửi của hộp thoại: "Xác nhận" kèm việc, theo lối các hộp thoại khác của hệ thống. */
	const CONFIRM_LABELS: Record<RequestActionKind, string> = {
		approve: 'Xác nhận đồng ý',
		reject: 'Xác nhận từ chối',
		return: 'Xác nhận trả lại',
		transfer: 'Xác nhận chuyển lượt',
		override: 'Xác nhận quyết định thay',
		reassign: 'Xác nhận đổi người duyệt',
	};

	/** Câu nhắc khi bỏ trống ô bắt buộc; viết sẵn từng câu thay vì ghép từ nhãn cho khỏi sai ngữ pháp. */
	const NOTE_REQUIRED_MESSAGES: Record<RequestActionKind, string> = {
		approve: '',
		reject: 'Bạn nhập lý do từ chối trước đã.',
		return: 'Bạn ghi rõ những gì cần bổ sung trước khi trả lại phiếu.',
		transfer: '',
		override: 'Bạn nhập lý do quyết định thay trước đã.',
		reassign: 'Bạn nhập lý do đổi người duyệt trước đã.',
	};

	/** Việc nào bắt buộc nhập lý do. */
	const noteRequired = computed(() => ['reject', 'return', 'override', 'reassign'].includes(props.kind));
	const needsTarget = computed(() => props.kind === 'transfer' || props.kind === 'reassign');

	/** Người đang giữ lượt ở các bước còn mở, để chọn "đổi người duyệt" của ai. */
	const holders = computed(() => {
		const open = props.request.steps.filter((step: RequestStep) => step.status === 'PENDING');
		const map = new Map<number, string>();
		for (const step of open) {
			for (const assignment of step.assignments) {
				if (assignment.status === 'PENDING') map.set(assignment.employee.id, assignment.employee.fullName);
			}
		}
		return [...map.entries()].map(([value, label]) => ({ value, label }));
	});

	onMounted(() => {
		if (props.kind === 'reassign' && holders.value.length === 1) fromEmployeeId.value = holders.value[0]!.value;
	});

	const choices = computed(() => props.people.filter(p => p.id !== fromEmployeeId.value));

	const DECISION_OPTIONS = [
		{ value: 'APPROVE', label: 'Đồng ý thay người đang giữ lượt' },
		{ value: 'REJECT', label: 'Từ chối thay người đang giữ lượt' },
		{ value: 'RETURN', label: 'Trả lại cho người gửi để bổ sung thay người đang giữ lượt' },
	];

	/** Câu xác nhận của "quyết định thay" phải nói đúng quyết định vừa chọn, không nói chung là đã duyệt. */
	const OVERRIDE_DONE: Record<OverrideDecision, string> = {
		APPROVE: 'Đã đồng ý phiếu thay người đang giữ lượt.',
		REJECT: 'Đã từ chối phiếu thay người đang giữ lượt.',
		RETURN: 'Đã trả lại phiếu cho người gửi thay người đang giữ lượt.',
	};

	const DONE_MESSAGES: Record<RequestActionKind, string> = {
		approve: 'Đã đồng ý phiếu.',
		reject: 'Đã từ chối phiếu.',
		return: 'Đã trả lại phiếu để người gửi bổ sung.',
		transfer: 'Đã chuyển lượt duyệt.',
		override: '',
		reassign: 'Đã đổi người duyệt.',
	};

	function validate(): boolean {
		error.value = null;
		const text = note.value.trim();
		if (noteRequired.value && !text) {
			error.value = NOTE_REQUIRED_MESSAGES[props.kind];
			return false;
		}
		if (props.kind === 'override' && text.length < 5) {
			error.value = 'Lý do quyết định thay phải có ít nhất năm ký tự.';
			return false;
		}
		if (needsTarget.value && !target.value.length) {
			error.value =
				props.kind === 'transfer' ? 'Bạn chọn người nhận lượt duyệt.' : 'Bạn chọn người duyệt mới cho phiếu.';
			return false;
		}
		if (props.kind === 'reassign' && !fromEmployeeId.value) {
			error.value = 'Bạn chọn người đang giữ lượt cần đổi.';
			return false;
		}
		return true;
	}

	async function submit() {
		if (!validate()) return;
		const id = props.request.id;
		const stepOrder = props.request.currentStep?.order;
		const text = note.value.trim();
		submitting.value = true;
		try {
			let updated: GeneralRequestDetail;
			switch (props.kind) {
				case 'approve':
					updated = await service.approve(id, { note: text || undefined, stepOrder });
					break;
				case 'reject':
					updated = await service.reject(id, { note: text, stepOrder });
					break;
				case 'return':
					updated = await service.returnForEdit(id, { note: text, stepOrder });
					break;
				case 'transfer':
					updated = await service.transfer(id, { toEmployeeId: target.value[0]!, note: text || undefined });
					break;
				case 'override':
					updated = await service.override(id, { decision: decision.value, note: text, stepOrder });
					break;
				case 'reassign':
					updated = await service.reassign(id, {
						fromEmployeeId: fromEmployeeId.value!,
						toEmployeeId: target.value[0]!,
						note: text,
					});
					break;
			}
			toast.success(props.kind === 'override' ? OVERRIDE_DONE[decision.value] : DONE_MESSAGES[props.kind]);
			emit('updated', updated);
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Chưa thực hiện được.';
			toast.error(message);
			// Bước đã có người xử lý, hoặc phiếu vừa đổi trạng thái: đóng hộp thoại và để trang
			// tải lại, vì nội dung đang hiện đã cũ.
			const code = apiErrorCode(e);
			if (code === 'REQUEST_NOT_PENDING' || code === 'REQUEST_IMMUTABLE') emit('conflict');
		} finally {
			submitting.value = false;
		}
	}
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="emit('close')">
		<div class="flex max-h-[92vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-900">
			<div class="flex-shrink-0 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
				<h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ TITLES[kind] }}</h3>
				<p class="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">{{ request.title }}</p>
			</div>

			<div class="flex-1 space-y-4 overflow-y-auto p-6">
				<p class="text-sm text-gray-600 dark:text-gray-300">{{ INTROS[kind] }}</p>

				<UiSelect
					v-if="kind === 'override'"
					:model-value="decision"
					:options="DECISION_OPTIONS"
					label="Quyết định"
					@update:model-value="value => (decision = value as OverrideDecision)"
				/>

				<UiSelect
					v-if="kind === 'reassign'"
					v-model="fromEmployeeId"
					:options="holders"
					label="Người đang giữ lượt"
					placeholder="Chọn người đang giữ lượt"
					:hint="holders.length ? undefined : 'Phiếu không còn bước nào đang chờ nên không đổi được người duyệt.'"
				/>

				<EmployeePicker
					v-if="needsTarget"
					v-model="target"
					:people="choices"
					single
					:label="kind === 'transfer' ? 'Người nhận lượt duyệt' : 'Người duyệt mới'"
				/>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						{{ NOTE_LABELS[kind] }}
						<span v-if="noteRequired" class="text-rose-500">*</span>
						<span v-else class="font-normal text-gray-400">(không bắt buộc)</span>
					</label>
					<textarea
						v-model="note"
						rows="3"
						class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
					<p v-if="error" class="text-xs text-rose-600 dark:text-rose-400">{{ error }}</p>
				</div>
			</div>

			<div class="flex flex-shrink-0 justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
				<CommonAppButton variant="secondary" @click="emit('close')">Hủy</CommonAppButton>
				<CommonAppButton
					:variant="kind === 'reject' ? 'danger' : 'primary'"
					:loading="submitting"
					@click="submit"
				>
					{{ CONFIRM_LABELS[kind] }}
				</CommonAppButton>
			</div>
		</div>
	</div>
</template>
