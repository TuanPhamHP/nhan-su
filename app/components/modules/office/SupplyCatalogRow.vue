<script setup lang="ts">
	import QtyInput from '~/components/modules/office/QtyInput.vue';
	import SupplyQtyStepper from '~/components/modules/office/SupplyQtyStepper.vue';
	import type { SupplyRowState } from '~/composables/useMySupplies';
	import { SUPPLY_NOTE_MAX } from '~/composables/useMySupplies';
	import { formatDateTime } from '~/utils/date';
	import { officeMoney, supplySharesLabel, type SupplyCatalogRow } from '~/utils/office.utils';

	/**
	 * Một mặt hàng trên form danh mục: tên, định mức, ô phần của tôi, số của cả phòng và ghi chú.
	 *
	 * Mọi cột có bề rộng cố định và luôn chiếm chỗ kể cả khi trống, nên lưu xong hiện dấu ✓, hay
	 * "Phòng: N" mọc ra sau khi người khác đăng ký, không làm cột nào xô lệch.
	 */
	const props = defineProps<{
		row: SupplyCatalogRow;
		state?: SupplyRowState;
		/** Số đang hiện trong ô. */
		qty: number | undefined;
		canEdit: boolean;
		/** Trưởng phòng, đầu mối: sửa phần của mọi người và xoá cả dòng. */
		canEditAllShares: boolean;
		saved: boolean;
		undoable: boolean;
		highlighted: boolean;
		showFinal: boolean;
		showReceived: boolean;
		/** Câu báo ngắn khi ô số vừa bị trả về số đã lưu. */
		notice?: string;
		saveNote: (note: string) => Promise<string | null>;
		saveShare: (employeeId: number, qty: number) => Promise<string | null>;
	}>();

	const emit = defineEmits<{
		input: [value: number | undefined, invalid: boolean];
		commit: [];
		bump: [delta: number];
		move: [direction: 1 | -1];
		reason: [value: string];
		retry: [];
		restore: [];
		delete: [];
	}>();

	const line = computed(() => props.row.line);
	const mine = computed(() => line.value?.myQty ?? 0);
	const chosen = computed(() => mine.value > 0 || (props.qty ?? 0) > 0);
	const status = computed(() => props.state?.status ?? 'idle');
	const hasOthers = computed(() => !!line.value?.shares.some(s => !s.isMine));

	/** "Sửa cuối bởi …" không chiếm chỗ cố định trên dòng nữa, chỉ hiện khi rê chuột vào tên. */
	const lastEdited = computed(() =>
		line.value ? `Sửa cuối bởi ${line.value.updatedBy.fullName} lúc ${formatDateTime(line.value.updatedAt)}` : undefined,
	);

	/** "Phòng: N" hiện khi phòng đã có dòng này, kể cả khi phần của tôi là 0, để khỏi đăng ký trùng. */
	const roomTitle = computed(() => {
		const l = line.value;
		if (!l) return '';
		return l.shares.length ? supplySharesLabel(l) : `Phòng đăng ký ${l.requestedQty}`;
	});

	/** Tổng của phòng nếu phần của tôi là số đang gõ; định mức tính trên tổng này. */
	const draftTotal = computed(() => (line.value?.requestedQty ?? 0) - mine.value + (props.qty ?? mine.value));

	/** Vượt định mức theo cờ máy chủ, hoặc ngay khi số đang gõ đẩy tổng của phòng qua định mức. */
	const overQuota = computed(
		() =>
			!!line.value?.overQuota ||
			status.value === 'reason' ||
			(props.row.quota != null && (props.qty ?? 0) > 0 && draftTotal.value > props.row.quota),
	);
	const showReason = computed(() => props.canEdit && (overQuota.value || !!props.state?.reason));
	const reasonText = computed(() => (props.state ? props.state.reason : (line.value?.overQuotaReason ?? '')));

	/** Xoá cả dòng chỉ cần khi dòng còn phần của người khác; dòng chỉ có phần mình thì đưa ô về 0. */
	const canDeleteWhole = computed(
		() =>
			props.canEdit &&
			!!line.value &&
			(props.canEditAllShares || !hasOthers.value) &&
			(hasOthers.value || !line.value.shares.length),
	);

	function onReasonInput(event: Event) {
		if (event.target instanceof HTMLInputElement) emit('reason', event.target.value);
	}

	// ─── Hộp "Phòng" ──────────────────────────────────────────────────────────

	const { open: roomOpen, root: roomRoot, above: roomAbove, toggle: toggleRoom, close: closeRoom } = usePopover();
	const shareEdits = reactive<Record<number, number | undefined>>({});
	const shareInvalid = reactive<Record<number, boolean>>({});
	const shareSaving = ref<number | null>(null);
	const shareError = ref('');

	watch(roomOpen, open => {
		if (!open || !line.value) return;
		shareError.value = '';
		for (const share of line.value.shares) {
			shareEdits[share.employee.id] = share.qty;
			shareInvalid[share.employee.id] = false;
		}
	});

	async function onSaveShare(employeeId: number) {
		const qty = shareEdits[employeeId];
		if (qty == null || shareInvalid[employeeId] || shareSaving.value) return;
		shareSaving.value = employeeId;
		shareError.value = (await props.saveShare(employeeId, qty)) ?? '';
		shareSaving.value = null;
	}

	// ─── Hộp ghi chú ──────────────────────────────────────────────────────────

	const { open: noteOpen, root: noteRoot, above: noteAbove, toggle: toggleNote, close: closeNote } = usePopover();
	const noteDraft = ref('');
	const noteError = ref('');
	const savingNote = ref(false);

	watch(noteOpen, open => {
		if (!open) return;
		noteDraft.value = line.value?.note ?? '';
		noteError.value = '';
	});

	async function onSaveNote() {
		if (savingNote.value) return;
		savingNote.value = true;
		noteError.value = (await props.saveNote(noteDraft.value)) ?? '';
		savingNote.value = false;
		if (!noteError.value) closeNote();
	}
</script>

<template>
	<div
		:class="[
			'px-3 py-1.5 transition-colors duration-700 sm:px-4',
			highlighted ? 'bg-amber-100 dark:bg-amber-900/30' : chosen ? 'bg-brand-50/70 dark:bg-brand-900/15' : '',
		]"
	>
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
			<!-- Tên dài xuống tối đa hai dòng; quá nữa thì tên đầy đủ vẫn nằm trong title. -->
			<p
				:class="[
					'min-w-0 flex-1 basis-48 text-sm leading-snug [overflow-wrap:anywhere] line-clamp-2',
					chosen ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400',
				]"
				:title="lastEdited ? `${row.name}\n${lastEdited}` : row.name"
			>
				{{ row.name }}<span class="font-normal text-gray-400 dark:text-gray-500"> · {{ row.unit || '—' }}</span>
			</p>

			<div class="flex shrink-0 items-center gap-2">
				<span class="w-24 text-right text-xs text-gray-500 dark:text-gray-400">
					<template v-if="row.quota != null">Định mức {{ row.quota }}</template>
				</span>

				<!-- Chỉ xem thì không có nút − / +, ô hẹp lại để cả dòng vẫn nằm trên một hàng ở 1024px. -->
				<div :class="canEdit ? 'w-32' : 'w-16'">
					<SupplyQtyStepper
						:model-value="qty"
						:label="`Phần của bạn, ${row.name}`"
						:disabled="!canEdit"
						:error="status === 'error' || status === 'reason' || !!state?.invalid"
						:max="100000"
						@input="(value, invalid) => emit('input', value, invalid)"
						@commit="emit('commit')"
						@bump="emit('bump', $event)"
						@move="emit('move', $event)"
					/>
				</div>

				<!-- Trạng thái lưu của dòng; chỗ luôn giữ sẵn nên dấu ✓ hiện ra không đẩy cột nào. -->
				<span class="flex w-4 justify-center" aria-hidden="true">
					<span
						v-if="status === 'saving'"
						class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
					/>
					<Transition leave-active-class="transition-opacity duration-700" leave-to-class="opacity-0">
						<span v-if="saved && status !== 'saving'" class="text-sm text-emerald-600 dark:text-emerald-400">✓</span>
					</Transition>
					<span v-if="status === 'error'" class="text-sm font-bold text-rose-600" :title="state?.error">!</span>
				</span>

				<!-- Số của cả phòng, hoặc nút Hoàn tác ngay sau khi bỏ chọn. -->
				<div ref="roomRoot" class="relative w-28">
					<button
						v-if="undoable"
						type="button"
						class="rounded px-1.5 py-1 text-xs font-medium text-brand-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-400"
						@click="emit('restore')"
					>
						Đã bỏ · Hoàn tác
					</button>
					<button
						v-else-if="line"
						type="button"
						data-popover-trigger
						:title="roomTitle"
						:aria-expanded="roomOpen"
						:class="[
							'rounded-md px-1.5 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
							hasOthers && !mine
								? 'bg-amber-50 font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300'
								: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
						]"
						@click="toggleRoom()"
					>
						Phòng: <span class="font-semibold tabular-nums">{{ line.requestedQty }}</span>
					</button>

					<div
						v-if="roomOpen && line"
						role="dialog"
						:aria-label="`Đăng ký của phòng, ${row.name}`"
						:class="[
							'absolute right-0 z-40 w-72 rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-xl dark:border-gray-700 dark:bg-gray-900',
							roomAbove ? 'bottom-full mb-1' : 'top-full mt-1',
						]"
					>
						<p class="font-medium text-gray-900 dark:text-white">
							Phòng đăng ký {{ line.requestedQty }} {{ (row.unit ?? '').toLocaleLowerCase('vi') }}
						</p>
						<ul v-if="line.shares.length" class="mt-2 space-y-1.5">
							<li v-for="share in line.shares" :key="share.employee.id" class="flex items-center gap-2">
								<span class="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">
									{{ share.isMine ? 'Bạn' : share.employee.fullName }}
								</span>
								<template v-if="canEdit && canEditAllShares && hasOthers">
									<div class="w-16">
										<QtyInput
											v-model="shareEdits[share.employee.id]"
											class="[&_input]:h-7 [&_input]:px-2 [&_input]:py-0.5"
											:max="100000"
											:aria-label="`Phần của ${share.employee.fullName}, ${row.name}`"
											@update:invalid="shareInvalid[share.employee.id] = $event"
											@save="onSaveShare(share.employee.id)"
										/>
									</div>
									<CommonAppButton
										size="sm"
										variant="ghost"
										:disabled="shareEdits[share.employee.id] === share.qty"
										:loading="shareSaving === share.employee.id"
										@click="onSaveShare(share.employee.id)"
									>
										Lưu
									</CommonAppButton>
								</template>
								<span v-else class="font-semibold tabular-nums text-gray-900 dark:text-white">{{ share.qty }}</span>
							</li>
						</ul>
						<p v-if="canEdit && canEditAllShares && hasOthers" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Bạn là trưởng phòng hoặc đầu mối nên sửa được phần của từng người; nhập 0 để rút phần người đó.
						</p>
						<p v-if="shareError" class="mt-1 text-xs text-rose-600 dark:text-rose-400">{{ shareError }}</p>
						<p v-if="line.previousQty != null" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
							Kỳ trước phòng nhận {{ line.previousQty }}.
						</p>
						<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">{{ lastEdited }}.</p>
						<button
							v-if="canDeleteWhole"
							type="button"
							class="mt-2 text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
							@click="
								closeRoom();
								emit('delete');
							"
						>
							Xoá cả dòng khỏi phiếu
						</button>
					</div>
				</div>

				<!-- Ghi chú của cả dòng; chấm nhỏ khi dòng đã có ghi chú. -->
				<div ref="noteRoot" class="relative w-8">
					<button
						v-if="canEdit || line?.note"
						type="button"
						data-popover-trigger
						:disabled="!line"
						:aria-label="line?.note ? `Ghi chú của ${row.name}: ${line.note}` : `Ghi chú cho ${row.name}`"
						:title="line ? line.note || 'Ghi chú' : 'Chọn số lượng trước rồi mới ghi chú'"
						:aria-expanded="noteOpen"
						class="relative flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-gray-800 dark:hover:text-gray-200"
						@click="toggleNote()"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
							/>
						</svg>
						<span v-if="line?.note" class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand-500" />
					</button>

					<div
						v-if="noteOpen && line"
						role="dialog"
						:aria-label="`Ghi chú, ${row.name}`"
						:class="[
							'absolute right-0 z-40 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900',
							noteAbove ? 'bottom-full mb-1' : 'top-full mt-1',
						]"
					>
						<template v-if="canEdit">
							<label :for="`supply-note-${row.key}`" class="text-xs font-medium text-gray-700 dark:text-gray-300">
								Ghi chú chung của phòng cho mặt hàng này
							</label>
							<textarea
								:id="`supply-note-${row.key}`"
								v-model="noteDraft"
								rows="3"
								:maxlength="SUPPLY_NOTE_MAX"
								class="mt-1 w-full resize-none rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
								placeholder="VD: loại ngòi 0.5"
							/>
							<div class="mt-1 flex items-center justify-between gap-2">
								<span class="text-xs text-gray-400">{{ noteDraft.length }}/{{ SUPPLY_NOTE_MAX }}</span>
								<div class="flex gap-1">
									<CommonAppButton size="sm" variant="ghost" @click="closeNote()">Thôi</CommonAppButton>
									<CommonAppButton
										size="sm"
										variant="primary"
										:loading="savingNote"
										:disabled="noteDraft.trim() === (line.note ?? '')"
										@click="onSaveNote"
									>
										Lưu
									</CommonAppButton>
								</div>
							</div>
							<p v-if="noteError" class="mt-1 text-xs text-rose-600 dark:text-rose-400">{{ noteError }}</p>
						</template>
						<template v-else>
							<p class="text-xs font-medium text-gray-700 dark:text-gray-300">Ghi chú chung của phòng cho mặt hàng này</p>
							<p class="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{{ line.note }}</p>
						</template>
						<!-- Máy chủ chỉ lưu người sửa cuối của cả dòng (số hoặc ghi chú), không riêng ghi chú. -->
						<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
							Sửa cuối dòng: {{ line.updatedBy.fullName }} lúc {{ formatDateTime(line.updatedAt) }}
						</p>
					</div>
				</div>

				<template v-if="!canEdit">
					<span v-if="showFinal" class="w-24 text-right text-xs" :title="line?.finalNote ?? undefined">
						<template v-if="line?.finalQty != null">
							Đã chốt <span class="font-semibold text-indigo-700 dark:text-indigo-300">{{ line.finalQty }}</span>
						</template>
					</span>
					<span v-if="showReceived" class="w-28 text-right text-xs" :title="line?.receivedNote ?? undefined">
						<template v-if="line?.receivedQty != null">
							Đã nhận
							<span class="font-semibold text-emerald-700 dark:text-emerald-300">{{ line.receivedQty }}</span>
						</template>
					</span>
					<span v-if="line?.amount != null" class="w-24 text-right text-xs text-gray-600 dark:text-gray-300">
						{{ officeMoney(line.amount) }}
					</span>
				</template>
			</div>
		</div>

		<!-- Vượt định mức: lý do nhập ngay dưới dòng; Enter hoặc rời ô là lưu cùng số. -->
		<div v-if="showReason" class="mt-1 flex flex-wrap items-center gap-2 pb-0.5">
			<span
				v-if="overQuota"
				class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
			>
				Vượt định mức
			</span>
			<label :for="`supply-reason-${row.key}`" class="text-xs font-medium text-amber-700 dark:text-amber-400">
				Lý do<span v-if="status === 'reason'" class="text-rose-500"> *</span>
			</label>
			<input
				:id="`supply-reason-${row.key}`"
				:value="reasonText"
				type="text"
				maxlength="500"
				class="h-7 min-w-0 flex-1 basis-60 rounded-lg border border-amber-300 bg-white px-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-800 dark:text-gray-100"
				placeholder="VD: Tháng này quyết toán, in nhiều"
				@input="onReasonInput"
				@keydown.enter.prevent="emit('commit')"
				@blur="state && emit('commit')"
			/>
		</div>
		<p v-else-if="!canEdit && line?.overQuota" class="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
			Vượt định mức: {{ line.overQuotaReason || 'chưa ghi lý do' }}
		</p>

		<p v-if="notice" role="status" class="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{{ notice }}</p>
		<p
			v-if="state?.error && (status === 'error' || status === 'reason')"
			role="alert"
			:class="['mt-0.5 text-xs', status === 'reason' ? 'text-amber-700 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400']"
		>
			{{ state.error }}
			<button
				v-if="status === 'error'"
				type="button"
				class="ml-1 font-medium underline hover:no-underline"
				@click="emit('retry')"
			>
				Thử lại
			</button>
		</p>
	</div>
</template>
