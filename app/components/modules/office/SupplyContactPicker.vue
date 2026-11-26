<script setup lang="ts">
	import type { SupplyContact } from '~/types/office.types';

	/**
	 * Dòng "Đầu mối nhận hàng" trong thanh kỳ, kèm hộp chọn người neo vào nút Đổi.
	 *
	 * Hộp nổi lên trên trang chứ không chèn vào giữa: trước đây form chọn đầu mối mở ngay tại chỗ và
	 * đẩy cả danh sách xuống, trong khi việc đổi đầu mối cả năm mới làm vài lần. Chỉ trưởng phòng đổi
	 * được, nên nút chỉ hiện với chính họ.
	 */
	const props = defineProps<{
		contact: SupplyContact;
		options: Array<{ value: number; label: string }>;
		isManager: boolean;
		saving: boolean;
		save: (employeeId: number | null) => Promise<boolean>;
	}>();

	const open = defineModel<boolean>('open', { default: false });
	const { root, above, alignEnd, toggle, close } = usePopover(open);

	const picked = ref<number | null>(null);
	const error = ref('');

	watch(open, value => {
		if (!value) return;
		picked.value = props.contact.contact?.id ?? null;
		error.value = '';
	});

	async function onSave() {
		// Chưa chọn ai mà vẫn gửi thì máy chủ hiểu là BỎ đầu mối; nói ra thay vì gửi một `null` mà
		// người dùng không chủ ý.
		if (picked.value == null) {
			error.value = 'Bạn chọn một nhân viên của phòng, hoặc bấm Bỏ đầu mối nếu muốn trả việc nhận hàng về trưởng phòng.';
			return;
		}
		if (await props.save(picked.value)) close();
	}

	async function onClear() {
		if (await props.save(null)) close();
	}
</script>

<template>
	<div data-tour="supply-contact" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
		<span class="text-gray-500 dark:text-gray-400">Đầu mối nhận hàng:</span>
		<span v-if="contact.contact" class="font-medium text-gray-800 dark:text-gray-100">{{ contact.contact.fullName }}</span>
		<span v-else class="font-medium text-amber-600 dark:text-amber-400">
			Chưa chọn đầu mối<template v-if="contact.manager">, trưởng phòng {{ contact.manager.fullName }} nhận hàng</template>
		</span>

		<div v-if="isManager" ref="root" class="relative">
			<button
				type="button"
				data-popover-trigger
				data-tour="supply-contact-pick"
				:aria-expanded="open"
				class="rounded-md px-1.5 py-0.5 text-sm font-medium text-brand-600 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-400 dark:hover:bg-brand-900/20"
				@click="toggle()"
			>
				{{ contact.contact ? 'Đổi' : 'Chọn đầu mối' }}
			</button>

			<div
				v-if="open"
				data-tour="supply-contact-form"
				role="dialog"
				aria-label="Chọn đầu mối nhận hàng"
				:class="[
					'absolute z-40 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900',
					above ? 'bottom-full mb-1' : 'top-full mt-1',
					alignEnd ? 'right-0' : 'left-0',
				]"
			>
				<p class="text-xs text-gray-500 dark:text-gray-400">
					Đầu mối nhận hàng khi HCNS cấp và bấm Đã nhận cho cả phòng. Bỏ đầu mối thì việc này về lại trưởng phòng.
				</p>
				<div class="mt-2">
					<UiSelectInput
						:model-value="picked"
						:options="options"
						size="sm"
						placeholder="Chọn nhân viên của phòng"
						search-placeholder="Tìm nhân viên"
						@update:model-value="
							picked = Number($event);
							error = '';
						"
					/>
				</div>
				<p v-if="error" class="mt-2 text-xs text-rose-600 dark:text-rose-400">{{ error }}</p>
				<div class="mt-3 flex flex-wrap items-center justify-end gap-2">
					<!-- Chưa có đầu mối thì không có gì để bỏ, nên nút cũng không hiện. -->
					<CommonAppButton v-if="contact.contact" size="sm" variant="ghost" :loading="saving" @click="onClear">
						Bỏ đầu mối
					</CommonAppButton>
					<CommonAppButton size="sm" variant="outline" @click="close()">Thôi</CommonAppButton>
					<CommonAppButton size="sm" variant="primary" :loading="saving" @click="onSave">Lưu đầu mối</CommonAppButton>
				</div>
			</div>
		</div>
	</div>
</template>
