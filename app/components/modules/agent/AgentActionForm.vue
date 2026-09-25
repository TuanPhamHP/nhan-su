<script setup lang="ts">
	import AppButton from '~/components/common/AppButton.vue';
	import type { AgentFormField, AgentPendingAction } from '~/types/agent.types';

	const props = defineProps<{ pending: AgentPendingAction }>();

	const emit = defineEmits<{
		confirm: [payload: Record<string, unknown>];
		cancel: [];
	}>();

	/**
	 * Bản nháp tách khỏi `props.pending.form` — người dùng sửa thoải mái mà form gốc
	 * (thứ backend đã hash để phát hiện dữ liệu đổi) vẫn nguyên vẹn để đối chiếu.
	 */
	const draft = ref<Record<string, string>>({});
	const touched = ref<Record<string, boolean>>({});
	const showErrors = ref(false);

	watch(
		() => props.pending.form,
		(form) => {
			const next: Record<string, string> = {};
			for (const f of form.fields) next[f.name] = f.value === null ? '' : String(f.value);
			draft.value = next;
			touched.value = {};
			showErrors.value = false;
		},
		{ immediate: true },
	);

	const locked = computed(() => props.pending.state !== 'idle');
	const submitting = computed(() => props.pending.state === 'submitting');

	/** `readonly` chỉ để đọc và KHÔNG vào payload — server tự dựng lại các giá trị đó. */
	const editable = computed(() => props.pending.form.fields.filter((f) => f.type !== 'readonly'));
	const readonlyFields = computed(() => props.pending.form.fields.filter((f) => f.type === 'readonly'));

	/** Điều kiện phụ thuộc ô khác, so trên GIÁ TRỊ HIỆN TẠI của bản nháp. */
	function matches(cond: { field: string; equals: string[] } | undefined): boolean {
		if (!cond) return false;
		return cond.equals.includes(String(draft.value[cond.field] ?? ''));
	}

	/** Ô có đang hiện không — ô ẩn thì không validate và không gửi lên. */
	function isVisible(f: AgentFormField): boolean {
		return !f.visibleWhen || matches(f.visibleWhen);
	}

	/** Bắt buộc cố định, hoặc bắt buộc vì ô khác đang mang một giá trị nhất định. */
	function isRequired(f: AgentFormField): boolean {
		if (f.required) return true;
		return matches(f.requiredWhen);
	}

	/**
	 * Lỗi của một ô, hoặc null nếu hợp lệ.
	 *
	 * `minLength` phải chặn ở đây vì server cũng kiểm — và ở luồng này, gửi rồi bị từ
	 * chối là MẤT LUÔN lượt xác nhận (backend không mở lại form). Để người dùng gõ
	 * "OT" cho ô đòi 10 ký tự rồi mới báo lỗi là bắt họ hỏi lại từ đầu.
	 */
	function invalidReason(f: AgentFormField): string | null {
		// Ô đang ẩn thì không xét: nó không liên quan tới lựa chọn hiện tại và người
		// dùng cũng không nhìn thấy để mà sửa.
		if (!isVisible(f)) return null;
		const value = String(draft.value[f.name] ?? '').trim();
		if (isRequired(f) && !value) return 'Bạn cần điền mục này';
		if (f.minLength && value.length > 0 && value.length < f.minLength) {
			return `Cần ít nhất ${f.minLength} ký tự (hiện ${value.length})`;
		}
		return null;
	}

	const missing = computed(() => editable.value.filter((f) => invalidReason(f) !== null));

	/** Hiện lỗi sau khi người dùng đã chạm vào ô, hoặc sau lần bấm gửi đầu tiên. */
	function errorFor(f: AgentFormField): string | null {
		const reason = invalidReason(f);
		if (!reason) return null;
		if (!showErrors.value && !touched.value[f.name]) return null;
		return reason;
	}

	function submit(): void {
		if (locked.value) return;
		showErrors.value = true;
		if (missing.value.length) return;

		const payload: Record<string, unknown> = {};
		for (const f of editable.value) {
			// Ô đang ẩn thì KHÔNG gửi lên: gửi `minutes` rỗng kèm đơn phép năm là đưa cho
			// server một tham số không thuộc về loại phép đó.
			if (!isVisible(f)) continue;
			const raw = draft.value[f.name] ?? '';
			if (f.type === 'number') payload[f.name] = raw === '' ? null : Number(raw);
			else if (f.type === 'select') {
				// Giá trị select về từ DOM luôn là string; trả lại số nếu option gốc là số,
				// nếu không backend nhận "3" cho một FK kiểu Int.
				const opt = f.options?.find((o) => String(o.value) === raw);
				payload[f.name] = opt ? opt.value : raw;
			} else payload[f.name] = raw;
		}
		emit('confirm', payload);
	}

	/**
	 * `text-base` (16px) trên mobile, `sm:text-sm` từ 640px lên.
	 *
	 * Safari iOS tự phóng to trang khi focus vào ô nhập có font < 16px. Form này có ô ngày,
	 * ô giờ và ô lý do — người dùng phải gõ vào chúng, nên cả form sẽ giật mỗi lần chạm.
	 */
	const inputClass =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base sm:text-sm text-gray-900 transition ' +
		'focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] focus:outline-none ' +
		'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 ' +
		'dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800';
</script>

<template>
	<div
		class="w-full overflow-hidden rounded-2xl border border-[var(--color-accent)]/30 bg-white shadow-sm dark:bg-gray-800"
	>
		<header
			class="flex items-center gap-2 border-b border-gray-200 bg-[var(--color-accent)]/5 px-4 py-2.5 dark:border-gray-700"
		>
			<Icon name="heroicons:clipboard-document-check" class="h-4 w-4 text-[var(--color-accent)]" />
			<h3 class="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
				{{ pending.form.title }}
			</h3>
			<span
				v-if="pending.state === 'idle' || submitting"
				class="shrink-0 rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--color-accent)]"
			>
				Chờ bạn xác nhận
			</span>
		</header>

		<!-- Đã xong / đã huỷ / hỏng hẳn → thu gọn, không mời bấm lại -->
		<div v-if="pending.state === 'done'" class="flex items-start gap-2 px-4 py-3 text-sm">
			<Icon name="heroicons:check-circle" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
			<p class="text-emerald-700 dark:text-emerald-400">
				{{ pending.message || 'Đã thực hiện.' }}
			</p>
		</div>

		<div v-else-if="pending.state === 'cancelled'" class="flex items-center gap-2 px-4 py-3 text-sm">
			<Icon name="heroicons:x-circle" class="h-4 w-4 shrink-0 text-gray-400" />
			<p class="text-gray-500 dark:text-gray-400">Bạn đã huỷ. Không có gì được gửi đi.</p>
		</div>

		<!--
			Thất bại là CHUNG CUỘC: backend chiếm quyền thực thi trước khi gọi commit và
			không mở lại, nên thẻ này không có nút thử lại — đường đi tiếp là nhắn lại.
		-->
		<div v-else-if="pending.state === 'failed'" class="flex items-start gap-2 px-4 py-3 text-sm">
			<Icon name="heroicons:exclamation-triangle" class="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
			<div>
				<p class="text-red-600 dark:text-red-400">{{ pending.message }}</p>
				<!-- KHÔNG hứa "chưa ghi gì": server tự nó cũng không biết commit đã đi tới đâu. -->
				<p class="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
					Bạn nhắn lại yêu cầu với thông tin đã sửa giúp mình nhé.
				</p>
			</div>
		</div>

		<form v-else class="px-4 py-3" @submit.prevent="submit">
			<!-- Dữ liệu do SERVER dựng, không phải lời văn của model -->
			<dl
				v-if="pending.form.context.length || readonlyFields.length"
				class="mb-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-900/40"
			>
				<div v-for="f in readonlyFields" :key="f.name" class="min-w-0">
					<dt class="text-[11px] text-gray-400 dark:text-gray-500">{{ f.label }}</dt>
					<dd class="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{{ f.value }}</dd>
				</div>
				<div v-for="c in pending.form.context" :key="c.label" class="min-w-0">
					<dt class="text-[11px] text-gray-400 dark:text-gray-500">{{ c.label }}</dt>
					<dd class="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{{ c.value }}</dd>
				</div>
			</dl>

			<ul
				v-if="pending.form.warnings.length"
				class="mb-3 space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10"
			>
				<li
					v-for="w in pending.form.warnings"
					:key="w"
					class="flex items-start gap-1.5 text-[13px] text-amber-800 dark:text-amber-300"
				>
					<Icon name="heroicons:exclamation-triangle" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
					<span>{{ w }}</span>
				</li>
			</ul>

			<div class="space-y-3">
				<div v-for="f in editable" v-show="isVisible(f)" :key="f.name">
					<label :for="`af-${pending.pendingActionId}-${f.name}`" class="mb-1 flex items-center gap-1.5">
						<span class="text-[13px] font-medium text-gray-700 dark:text-gray-200">{{ f.label }}</span>
						<!-- Dấu * theo trạng thái HIỆN TẠI: chọn "Từ chối" thì ô Ghi chú mới hiện sao -->
						<span v-if="isRequired(f)" class="text-red-500">*</span>
						<!-- Người dùng PHẢI phân biệt được cái gì là máy đoán để mà soát -->
						<span
							v-if="f.source === 'llm'"
							class="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
							title="Giá trị này do trợ lý suy ra từ câu bạn nói — kiểm tra lại giúp nhé"
						>
							<Icon name="heroicons:sparkles" class="h-2.5 w-2.5" />
							máy đoán
						</span>
					</label>

					<select
						v-if="f.type === 'select'"
						:id="`af-${pending.pendingActionId}-${f.name}`"
						v-model="draft[f.name]"
						:disabled="locked"
						:class="inputClass"
						@change="touched[f.name] = true"
					>
						<option v-for="o in f.options" :key="String(o.value)" :value="String(o.value)">
							{{ o.label }}
						</option>
					</select>

					<textarea
						v-else-if="f.type === 'textarea'"
						:id="`af-${pending.pendingActionId}-${f.name}`"
						v-model="draft[f.name]"
						:disabled="locked"
						rows="2"
						:placeholder="f.helpText"
						:class="inputClass"
						@blur="touched[f.name] = true"
					/>

					<input
						v-else
						:id="`af-${pending.pendingActionId}-${f.name}`"
						v-model="draft[f.name]"
						:type="f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'"
						:disabled="locked"
						:class="inputClass"
						@blur="touched[f.name] = true"
					/>

					<p v-if="errorFor(f)" class="mt-1 text-[11px] text-red-500">{{ errorFor(f) }}</p>
					<p
						v-else-if="f.helpText && f.type !== 'textarea'"
						class="mt-1 text-[11px] text-gray-400 dark:text-gray-500"
					>
						{{ f.helpText }}
					</p>
				</div>
			</div>

			<!--
				Lỗi còn sửa được (400 nghiệp vụ, mạng chập chờn): thẻ vẫn mở để gửi lại, nên
				lý do PHẢI hiện ngay tại đây. Chỉ set `error` ở composable thì không chỗ nào
				vẽ ra và người dùng bấm gửi xong thấy y nguyên, tưởng nút hỏng.
			-->
			<p
				v-if="pending.message"
				class="mt-3 flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
			>
				<Icon name="heroicons:exclamation-circle" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
				<span>{{ pending.message }}</span>
			</p>

			<div class="mt-4 flex items-center justify-end gap-2">
				<AppButton variant="ghost" size="sm" :disabled="locked" @click="emit('cancel')">Huỷ</AppButton>
				<AppButton type="submit" size="sm" :loading="submitting" :disabled="locked">
					{{ pending.form.submitLabel }}
				</AppButton>
			</div>
		</form>
	</div>
</template>
