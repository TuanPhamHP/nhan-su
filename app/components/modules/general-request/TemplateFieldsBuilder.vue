<script setup lang="ts">
import type { FieldDataSource, FieldDefinition, FieldType } from '~/types/general-request.types';
import { fieldKeyFromLabel, sanitizeFieldKey } from '~/utils/form-field-key';

/**
 * Soạn các câu hỏi của một loại phiếu theo kiểu Google Form.
 *
 * Mỗi câu là một thẻ. Thẻ đang chọn mở ra để sửa (câu hỏi, loại, lựa chọn, bắt buộc), các thẻ khác
 * chỉ hiện câu hỏi và hình dạng ô trả lời như người gửi phiếu sẽ thấy. Kéo tay nắm ở đầu thẻ để đổi
 * thứ tự. Mã chèn mẫu in (`key`) tự sinh từ câu hỏi cho câu mới thêm, và thôi đi theo câu hỏi khi
 * người soạn tự sửa mã; câu đã có từ trước giữ nguyên mã, vì mẫu in và các phiếu cũ đang dùng mã đó.
 */
const fields = defineModel<FieldDefinition[]>({ required: true });

const toast = useToast();

const TYPE_OPTIONS: { value: FieldType; label: string; icon: string }[] = [
	{ value: 'text', label: 'Câu trả lời ngắn', icon: 'heroicons:bars-2' },
	{ value: 'textarea', label: 'Đoạn văn', icon: 'heroicons:bars-3-bottom-left' },
	{ value: 'number', label: 'Số', icon: 'heroicons:hashtag' },
	{ value: 'date', label: 'Ngày', icon: 'heroicons:calendar-days' },
	{ value: 'select', label: 'Chọn từ danh sách', icon: 'heroicons:chevron-up-down' },
	{ value: 'checkbox', label: 'Ô đánh dấu', icon: 'heroicons:check-circle' },
];

const SOURCE_OPTIONS: { value: FieldDataSource; label: string; hint: string }[] = [
	{ value: 'custom', label: 'Tự nhập', hint: '' },
	{ value: 'departments', label: 'Phòng ban', hint: 'Danh sách phòng ban của công ty' },
	{ value: 'employees', label: 'Nhân viên', hint: 'Danh sách nhân viên đang làm việc' },
	{ value: 'positions', label: 'Vị trí', hint: 'Danh sách vị trí công việc' },
];

const listRef = ref<HTMLElement | null>(null);
const activeUid = ref<number | null>(null);

// Thẻ cần id bền để Vue không vẽ nhầm ô nhập khi đổi thứ tự, mà `FieldDefinition` không có id riêng
// (mã thì người soạn sửa được). Gắn id theo chính đối tượng, đối tượng giữ nguyên khi kéo thả.
const uids = new WeakMap<FieldDefinition, number>();
let nextUid = 1;
/** Câu thêm trong lần soạn này mà người soạn chưa tự sửa mã: mã còn đi theo câu hỏi. */
const autoKey = new WeakSet<FieldDefinition>();

function uidOf(f: FieldDefinition): number {
	const raw = toRaw(f);
	let id = uids.get(raw);
	if (!id) {
		id = nextUid++;
		uids.set(raw, id);
	}
	return id;
}

// Viết `{{` ngay trong template thì Vue hiểu là mở biểu thức, nên ghép chỗ chèn ở đây.
const BRACE_OPEN = '{{';
const BRACE_CLOSE = '}}';
const placeholderOf = (key: string) => `${BRACE_OPEN}${key}${BRACE_CLOSE}`;

const typeMeta = (t: FieldType) => TYPE_OPTIONS.find(o => o.value === t) ?? TYPE_OPTIONS[0]!;
const isCustomList = (f: FieldDefinition) => f.type === 'select' && (!f.dataSource || f.dataSource === 'custom');
const sourceHint = (f: FieldDefinition) => SOURCE_OPTIONS.find(s => s.value === f.dataSource)?.hint ?? '';

function takenKeys(except?: FieldDefinition): Set<string> {
	const skip = except ? toRaw(except) : null;
	return new Set(fields.value.filter(f => toRaw(f) !== skip).map(f => f.key));
}

function focusIn(uid: number, selector: string, select = false) {
	nextTick(() => {
		const el = listRef.value?.querySelector<HTMLInputElement>(`[data-sortable-id="${uid}"] ${selector}`);
		if (!el) return;
		el.focus();
		if (select) el.select();
		el.closest('[data-sortable-id]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	});
}

function activate(f: FieldDefinition) {
	activeUid.value = uidOf(f);
}

function insertAfterActive(f: FieldDefinition) {
	const idx = fields.value.findIndex(x => uidOf(x) === activeUid.value);
	const next = [...fields.value];
	next.splice(idx < 0 ? next.length : idx + 1, 0, f);
	fields.value = next;
	activeUid.value = uidOf(f);
}

function addField() {
	const f: FieldDefinition = { key: '', label: '', type: 'text', required: false, placeholder: '', options: [] };
	f.key = fieldKeyFromLabel('', takenKeys());
	autoKey.add(f);
	insertAfterActive(f);
	focusIn(uidOf(f), '[data-field-label]');
}

function duplicate(f: FieldDefinition) {
	const copy: FieldDefinition = { ...toRaw(f), options: [...(f.options ?? [])] };
	copy.key = fieldKeyFromLabel(copy.label, takenKeys());
	autoKey.add(copy);
	insertAfterActive(copy);
	focusIn(uidOf(copy), '[data-field-label]', true);
}

function remove(f: FieldDefinition) {
	const before = [...fields.value];
	const idx = before.findIndex(x => toRaw(x) === toRaw(f));
	fields.value = before.filter((_, i) => i !== idx);
	const neighbour = fields.value[idx] ?? fields.value[idx - 1];
	activeUid.value = neighbour ? uidOf(neighbour) : null;
	toast.info(`Đã xoá ${f.label.trim() ? `câu "${f.label.trim()}"` : 'câu hỏi'}`, {
		action: {
			label: 'Hoàn tác',
			run: () => {
				fields.value = before;
				activeUid.value = uidOf(f);
			},
		},
	});
}

function move(f: FieldDefinition, dir: -1 | 1) {
	const idx = fields.value.findIndex(x => toRaw(x) === toRaw(f));
	const to = idx + dir;
	if (idx < 0 || to < 0 || to >= fields.value.length) return;
	const next = [...fields.value];
	next.splice(idx, 1);
	next.splice(to, 0, f);
	fields.value = next;
}

function setLabel(f: FieldDefinition, value: string) {
	f.label = value;
	if (autoKey.has(toRaw(f))) f.key = fieldKeyFromLabel(value, takenKeys(f));
}

function setKey(f: FieldDefinition, e: Event) {
	const input = e.target as HTMLInputElement;
	const clean = sanitizeFieldKey(input.value);
	if (clean !== input.value) input.value = clean;
	f.key = clean;
	autoKey.delete(toRaw(f));
}

function setType(f: FieldDefinition, value: string | number | undefined) {
	const type = value as FieldType;
	f.type = type;
	if (type === 'select' && !f.dataSource) f.dataSource = 'custom';
	if (type === 'select' && isCustomList(f) && !(f.options ?? []).some(o => o.trim())) f.options = ['Lựa chọn 1'];
}

function setSource(f: FieldDefinition, source: FieldDataSource) {
	f.dataSource = source;
	if (source === 'custom' && !(f.options ?? []).some(o => o.trim())) f.options = ['Lựa chọn 1'];
}

// ─── Lựa chọn của câu danh sách tự nhập ───────────────────────────────────────

function setOption(f: FieldDefinition, i: number, value: string) {
	const opts = [...(f.options ?? [])];
	opts[i] = value;
	f.options = opts;
}

function insertOptions(f: FieldDefinition, at: number, values: string[]) {
	const opts = [...(f.options ?? [])];
	opts.splice(at, 0, ...values);
	f.options = opts;
	focusIn(uidOf(f), `[data-option-index="${at + values.length - 1}"]`, true);
}

function addOption(f: FieldDefinition) {
	const n = (f.options ?? []).length;
	insertOptions(f, n, [`Lựa chọn ${n + 1}`]);
}

function removeOption(f: FieldDefinition, i: number) {
	f.options = (f.options ?? []).filter((_, j) => j !== i);
	if (i > 0) focusIn(uidOf(f), `[data-option-index="${i - 1}"]`);
}

/** Enter thêm lựa chọn ngay dưới; Backspace ở ô trống thì xoá ô đó, như Google Form. */
function onOptionKeydown(e: KeyboardEvent, f: FieldDefinition, i: number) {
	if (e.key === 'Enter') {
		e.preventDefault();
		insertOptions(f, i + 1, ['']);
	} else if (e.key === 'Backspace' && !(f.options ?? [])[i] && (f.options ?? []).length > 1) {
		e.preventDefault();
		removeOption(f, i);
	}
}

/** Dán nhiều dòng (VD chép từ Excel) thì mỗi dòng thành một lựa chọn. */
function onOptionPaste(e: ClipboardEvent, f: FieldDefinition, i: number) {
	const lines = (e.clipboardData?.getData('text') ?? '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
	if (lines.length < 2) return;
	e.preventDefault();
	const opts = [...(f.options ?? [])];
	const replaceCurrent = !opts[i]?.trim();
	opts.splice(replaceCurrent ? i : i + 1, replaceCurrent ? 1 : 0, ...lines);
	f.options = opts;
	focusIn(uidOf(f), `[data-option-index="${(replaceCurrent ? i : i + 1) + lines.length - 1}"]`);
}

async function copyKey(f: FieldDefinition) {
	try {
		await navigator.clipboard.writeText(placeholderOf(f.key));
		toast.success(`Đã chép ${placeholderOf(f.key)}, dán vào mẫu in ở chỗ cần hiện câu trả lời`);
	} catch {
		toast.error('Trình duyệt không cho chép, hãy bôi đen mã để chép tay');
	}
}

useSortableList(listRef, {
	group: 'template-fields',
	handle: '[data-drag-handle]',
	onDrop: ({ id, newIndex }) => {
		const idx = fields.value.findIndex(f => uidOf(f) === id);
		if (idx < 0 || idx === newIndex) return;
		const next = [...fields.value];
		const [moved] = next.splice(idx, 1);
		next.splice(newIndex, 0, moved!);
		fields.value = next;
	},
});
</script>

<template>
	<div class="space-y-3">
		<div class="flex items-center justify-between gap-3">
			<div>
				<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Câu hỏi trong phiếu</h3>
				<p class="text-xs text-gray-400">Bấm vào một câu để sửa, kéo tay nắm ở đầu thẻ để đổi thứ tự.</p>
			</div>
			<CommonAppButton size="sm" variant="secondary" type="button" @click="addField">
				<Icon name="heroicons:plus" class="h-4 w-4" />
				Thêm câu hỏi
			</CommonAppButton>
		</div>

		<button
			v-if="fields.length === 0"
			type="button"
			class="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-gray-200 py-8 text-sm text-gray-400 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-gray-700"
			@click="addField"
		>
			<Icon name="heroicons:plus-circle" class="h-6 w-6" />
			Chưa có câu hỏi nào, bấm để thêm câu đầu tiên
		</button>

		<div ref="listRef" class="space-y-3">
			<div
				v-for="(field, idx) in fields"
				:key="uidOf(field)"
				:data-sortable-id="uidOf(field)"
				class="group relative overflow-hidden rounded-xl border bg-white transition-shadow dark:bg-gray-900"
				:class="
					activeUid === uidOf(field)
						? 'border-gray-200 shadow-md dark:border-gray-700'
						: 'cursor-pointer border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
				"
				@click="activate(field)"
				@focusin="activate(field)"
			>
				<div v-if="activeUid === uidOf(field)" class="absolute inset-y-0 left-0 w-1.5 bg-brand-500" />

				<div
					data-drag-handle
					class="flex cursor-grab justify-center pt-1 text-gray-300 opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100 dark:text-gray-600"
					:class="{ 'opacity-100': activeUid === uidOf(field) }"
					title="Kéo để đổi thứ tự"
				>
					<Icon name="mdi:drag-horizontal-variant" class="h-4 w-4" />
				</div>

				<!-- Thẻ đang sửa -->
				<div v-if="activeUid === uidOf(field)" class="space-y-4 px-5 pb-4 pt-1">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-start">
						<input
							:value="field.label"
							data-field-label
							type="text"
							placeholder="Câu hỏi"
							class="min-w-0 flex-1 border-0 border-b-2 border-gray-200 bg-gray-50 px-3 py-2.5 text-base text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
							@input="setLabel(field, ($event.target as HTMLInputElement).value)"
						/>
						<div class="flex items-center gap-2 sm:w-56">
							<Icon :name="typeMeta(field.type).icon" class="h-5 w-5 shrink-0 text-gray-400" />
							<UiSelect
								class="flex-1"
								:model-value="field.type"
								:options="TYPE_OPTIONS"
								@update:model-value="setType(field, $event)"
							/>
						</div>
					</div>

					<!-- Gợi ý trong ô: trang gửi phiếu chỉ dùng cho ô chữ, ô số và chữ cạnh ô đánh dấu -->
					<input
						v-if="['text', 'textarea', 'number', 'checkbox'].includes(field.type)"
						v-model="field.placeholder"
						type="text"
						:placeholder="field.type === 'checkbox' ? 'Chữ cạnh ô đánh dấu, VD Tôi xác nhận thông tin là đúng' : 'Chữ gợi ý trong ô (không bắt buộc)'"
						class="w-full border-0 border-b border-dotted border-gray-300 bg-transparent px-0 py-1.5 text-sm text-gray-600 placeholder:text-gray-400 focus:border-solid focus:border-brand-500 focus:outline-none focus:ring-0 dark:border-gray-600 dark:text-gray-300"
						:class="{ 'sm:w-2/3': field.type !== 'textarea' }"
					/>
					<div v-else-if="field.type === 'date'" class="flex w-48 items-center justify-between border-b border-dotted border-gray-300 py-1.5 text-sm text-gray-400 dark:border-gray-600">
						Ngày / tháng / năm
						<Icon name="heroicons:calendar-days" class="h-4 w-4" />
					</div>

					<template v-if="field.type === 'select'">
						<div class="flex flex-wrap items-center gap-1.5">
							<span class="mr-1 text-xs text-gray-500">Lấy lựa chọn từ</span>
							<button
								v-for="src in SOURCE_OPTIONS"
								:key="src.value"
								type="button"
								class="rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors"
								:class="
									(field.dataSource ?? 'custom') === src.value
										? 'bg-brand-50 text-brand-700 ring-brand-300 dark:bg-brand-900/30 dark:text-brand-300 dark:ring-brand-700'
										: 'text-gray-600 ring-gray-200 hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-gray-800'
								"
								@click="setSource(field, src.value)"
							>
								{{ src.label }}
							</button>
						</div>

						<div v-if="isCustomList(field)" class="space-y-1">
							<div v-for="(opt, i) in field.options ?? []" :key="i" class="group/opt flex items-center gap-3">
								<span class="h-4 w-4 shrink-0 rounded-full border-2 border-gray-300 dark:border-gray-600" />
								<input
									:value="opt"
									:data-option-index="i"
									type="text"
									:placeholder="`Lựa chọn ${i + 1}`"
									class="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent px-0 py-1.5 text-sm text-gray-800 hover:border-gray-200 focus:border-brand-500 focus:outline-none focus:ring-0 dark:text-gray-200 dark:hover:border-gray-700"
									@input="setOption(field, i, ($event.target as HTMLInputElement).value)"
									@keydown="onOptionKeydown($event, field, i)"
									@paste="onOptionPaste($event, field, i)"
								/>
								<button
									v-if="(field.options ?? []).length > 1"
									type="button"
									class="rounded-full p-1.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-600 focus:opacity-100 group-hover/opt:opacity-100 dark:hover:bg-gray-800"
									title="Xoá lựa chọn"
									@click="removeOption(field, i)"
								>
									<Icon name="heroicons:x-mark" class="h-4 w-4" />
								</button>
							</div>
							<div class="flex items-center gap-3">
								<span class="h-4 w-4 shrink-0 rounded-full border-2 border-gray-200 dark:border-gray-700" />
								<button type="button" class="py-1.5 text-sm text-gray-400 hover:text-brand-600" @click="addOption(field)">
									Thêm lựa chọn
								</button>
							</div>
							<p class="pl-7 text-xs text-gray-400">Enter để thêm dòng, dán nhiều dòng thì mỗi dòng thành một lựa chọn.</p>
						</div>
						<p v-else class="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
							<Icon name="heroicons:arrow-path" class="h-4 w-4 shrink-0" />
							{{ sourceHint(field) }}, tải từ hệ thống khi người dùng điền phiếu nên luôn mới nhất.
						</p>
					</template>

					<div class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
						<label class="flex items-center gap-1 text-xs text-gray-500" title="Dán mã này vào mẫu in ở chỗ cần hiện câu trả lời">
							<span class="mr-1">Mã chèn mẫu in</span>
							<span class="font-mono text-gray-400">{{ BRACE_OPEN }}</span>
							<input
								:value="field.key"
								type="text"
								spellcheck="false"
								class="w-36 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-xs text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
								@input="setKey(field, $event)"
							/>
							<span class="font-mono text-gray-400">{{ BRACE_CLOSE }}</span>
							<button type="button" class="ml-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800" title="Chép mã" @click="copyKey(field)">
								<Icon name="heroicons:clipboard-document" class="h-4 w-4" />
							</button>
						</label>

						<div class="flex items-center gap-1">
							<button type="button" class="rounded-full p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800" title="Lên trên" :disabled="idx === 0" @click.stop="move(field, -1)">
								<Icon name="heroicons:arrow-up" class="h-4 w-4" />
							</button>
							<button type="button" class="rounded-full p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800" title="Xuống dưới" :disabled="idx === fields.length - 1" @click.stop="move(field, 1)">
								<Icon name="heroicons:arrow-down" class="h-4 w-4" />
							</button>
							<button type="button" class="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" title="Nhân bản" @click.stop="duplicate(field)">
								<Icon name="heroicons:document-duplicate" class="h-5 w-5" />
							</button>
							<button type="button" class="rounded-full p-2 text-gray-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20" title="Xoá câu hỏi" @click.stop="remove(field)">
								<Icon name="heroicons:trash" class="h-5 w-5" />
							</button>
							<span class="mx-2 h-6 w-px bg-gray-200 dark:bg-gray-700" />
							<label class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
								Bắt buộc
								<button
									type="button"
									role="switch"
									:aria-checked="field.required"
									class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
									:class="field.required ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'"
									@click="field.required = !field.required"
								>
									<span
										class="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
										:class="field.required ? 'translate-x-[18px]' : 'translate-x-0.5'"
									/>
								</button>
							</label>
						</div>
					</div>
				</div>

				<!-- Thẻ thu gọn: hiện như người gửi phiếu sẽ thấy -->
				<div v-else class="px-5 pb-4 pt-0.5">
					<div class="flex items-start justify-between gap-3">
						<p class="text-sm font-medium" :class="field.label.trim() ? 'text-gray-900 dark:text-gray-100' : 'italic text-gray-400'">
							{{ field.label.trim() || 'Câu hỏi chưa có tiêu đề' }}
							<span v-if="field.required" class="text-rose-500">*</span>
						</p>
						<span class="shrink-0 font-mono text-[11px] text-gray-400">{{ placeholderOf(field.key) }}</span>
					</div>

					<div v-if="field.type === 'select' && isCustomList(field)" class="mt-2 space-y-1.5">
						<div v-for="(opt, i) in (field.options ?? []).filter(o => o.trim()).slice(0, 4)" :key="i" class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
							<span class="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-gray-300 dark:border-gray-600" />
							{{ opt }}
						</div>
						<p v-if="(field.options ?? []).filter(o => o.trim()).length > 4" class="pl-6 text-xs text-gray-400">
							và {{ (field.options ?? []).filter(o => o.trim()).length - 4 }} lựa chọn khác
						</p>
					</div>
					<p v-else-if="field.type === 'select'" class="mt-2 flex items-center gap-2 text-sm text-gray-400">
						<Icon name="heroicons:chevron-up-down" class="h-4 w-4" />
						{{ sourceHint(field) }}
					</p>
					<div v-else-if="field.type === 'checkbox'" class="mt-2 flex items-center gap-2 text-sm text-gray-500">
						<span class="h-4 w-4 rounded border-2 border-gray-300 dark:border-gray-600" />
						{{ field.placeholder || field.label || 'Ô đánh dấu' }}
					</div>
					<div
						v-else
						class="mt-3 flex items-center justify-between border-b border-dotted border-gray-300 pb-1 text-sm text-gray-400 dark:border-gray-600"
						:class="{ 'w-1/2': field.type === 'text', 'w-full': field.type === 'textarea', 'w-40': field.type === 'number' || field.type === 'date' }"
					>
						{{ field.type === 'date' ? 'Ngày / tháng / năm' : field.placeholder || typeMeta(field.type).label }}
						<Icon v-if="field.type === 'date'" name="heroicons:calendar-days" class="h-4 w-4" />
					</div>
				</div>
			</div>
		</div>

		<button
			v-if="fields.length > 0"
			type="button"
			class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-2.5 text-sm text-gray-500 transition-colors hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-600 dark:border-gray-700 dark:hover:bg-brand-900/10"
			@click="addField"
		>
			<Icon name="heroicons:plus" class="h-4 w-4" />
			Thêm câu hỏi
		</button>
	</div>
</template>
