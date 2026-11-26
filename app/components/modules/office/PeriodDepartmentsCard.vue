<script setup lang="ts">
	import { supplyStatusLabel, supplyStatusMeta } from '~/utils/office.utils';
	import type { SummaryDepartment, SummaryRequestRef } from '~/types/office.types';

	/**
	 * Phòng của kỳ: ai đã đăng ký, ai chưa, mỗi phòng một chip thay cho chín dòng "Phiếu chính · N dòng"
	 * giống hệt nhau. Chip bấm vào là mở phiếu như trước; phòng có phiếu bổ sung thì chip mở danh sách
	 * các phiếu của phòng. "Xem từng phiếu" mở danh sách đầy đủ, mỗi phiếu một dòng.
	 */
	const props = defineProps<{
		departments: SummaryDepartment[];
		periodStatus: string;
		/** Có hành động trên phiếu (chốt, cấp…): mở sẵn danh sách khi kỳ đã khoá. */
		canAct: boolean;
		registered: number;
	}>();

	const emit = defineEmits<{ open: [requestId: number] }>();

	const expanded = ref(props.periodStatus !== 'OPEN' && props.canAct);
	const popoverFor = ref<number | null>(null);

	function lineCount(dept: SummaryDepartment): number {
		return dept.requests.reduce((sum, r) => sum + r.lineCount, 0);
	}

	function requestName(dept: SummaryDepartment, req: SummaryRequestRef): string {
		if (dept.requests.length < 2) return '';
		return req.sequence === 0 ? 'Phiếu chính' : `Phiếu bổ sung ${req.sequence}`;
	}

	/** Trạng thái phiếu chỉ hiện khi khác "Đang đăng ký": lặp lại ở mọi chip chỉ gây nhiễu. */
	function chipStatus(dept: SummaryDepartment): string {
		if (dept.requests.length !== 1) return '';
		const req = dept.requests[0];
		if (!req || req.status === 'OPEN') return '';
		return supplyStatusLabel(req.status, req.lineCount);
	}

	/** Việc trên phiếu theo trạng thái, đúng như nút trong hộp phiếu; còn lại là xem. */
	function actionLabel(req: SummaryRequestRef): string {
		if (!props.canAct) return 'Xem';
		if (req.status === 'LOCKED' && req.lineCount > 0) return 'Chốt';
		if (req.status === 'FINALIZED') return 'Cấp';
		return 'Xem';
	}

	function onChip(dept: SummaryDepartment) {
		const only = dept.requests.length === 1 ? dept.requests[0] : undefined;
		if (only) emit('open', only.id);
		else popoverFor.value = popoverFor.value === dept.departmentId ? null : dept.departmentId;
	}

	function onDocPointer(event: PointerEvent) {
		if (!(event.target instanceof Element) || !event.target.closest('[data-dept-chip]')) popoverFor.value = null;
	}

	watch(popoverFor, open => {
		document.removeEventListener('pointerdown', onDocPointer);
		if (open != null) document.addEventListener('pointerdown', onDocPointer);
	});

	onUnmounted(() => document.removeEventListener('pointerdown', onDocPointer));
</script>

<template>
	<section
		data-tour="period-departments"
		class="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
		aria-labelledby="period-departments-title"
	>
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 id="period-departments-title" class="text-sm font-semibold text-gray-800 dark:text-gray-100">
				Phòng · <span class="tabular-nums">{{ registered }}/{{ departments.length }}</span> đã đăng ký
			</h2>
			<button
				v-if="departments.length"
				type="button"
				:aria-expanded="expanded"
				aria-controls="period-request-list"
				class="rounded text-sm font-medium text-brand-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-400"
				@click="expanded = !expanded"
			>
				{{ expanded ? 'Thu gọn danh sách phiếu' : 'Xem từng phiếu' }}
			</button>
		</div>

		<p v-if="!departments.length" class="py-4 text-sm text-gray-500 dark:text-gray-400">Kỳ này chưa có phòng nào tham gia.</p>

		<ul v-else-if="!expanded" class="mt-2 flex flex-wrap gap-1.5">
			<li v-for="dept in departments" :key="dept.departmentId" class="relative" data-dept-chip>
				<button
					type="button"
					:aria-haspopup="dept.requests.length > 1 ? 'true' : undefined"
					:aria-expanded="dept.requests.length > 1 ? popoverFor === dept.departmentId : undefined"
					:class="[
						'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
						lineCount(dept) > 0
							? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
							: 'border-gray-200 bg-white text-gray-500 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400',
					]"
					@click="onChip(dept)"
				>
					<span aria-hidden="true">{{ lineCount(dept) > 0 ? '✓' : '○' }}</span>
					<span class="[overflow-wrap:anywhere]">{{ dept.name }}</span>
					<span v-if="lineCount(dept) > 0" class="tabular-nums opacity-80">· {{ lineCount(dept) }} dòng</span>
					<span v-else class="sr-only">, chưa đăng ký</span>
					<span v-if="dept.requests.length > 1" class="opacity-80">· {{ dept.requests.length }} phiếu</span>
					<span
						v-if="chipStatus(dept)"
						:class="['rounded-full px-1.5 py-px text-[11px] font-medium', supplyStatusMeta(dept.requests[0]?.status ?? '').class]"
					>
						{{ chipStatus(dept) }}
					</span>
				</button>
				<!-- Phòng có nhiều phiếu: chọn phiếu cần mở. -->
				<div
					v-if="popoverFor === dept.departmentId"
					role="menu"
					class="absolute left-0 top-full z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900"
				>
					<button
						v-for="req in dept.requests"
						:key="req.id"
						type="button"
						role="menuitem"
						class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none dark:hover:bg-gray-800 dark:focus:bg-gray-800"
						@click="
							popoverFor = null;
							emit('open', req.id);
						"
					>
						<span class="text-gray-800 dark:text-gray-100">{{ requestName(dept, req) }} · {{ req.lineCount }} dòng</span>
						<span :class="['shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', supplyStatusMeta(req.status).class]">
							{{ supplyStatusLabel(req.status, req.lineCount) }}
						</span>
					</button>
				</div>
			</li>
		</ul>

		<!-- Danh sách đầy đủ: mỗi phiếu một dòng, kèm việc theo trạng thái (mở hộp phiếu như trước). -->
		<ul v-else id="period-request-list" class="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
			<template v-for="dept in departments" :key="dept.departmentId">
				<li
					v-for="req in dept.requests"
					:key="req.id"
					class="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-sm"
				>
					<span class="min-w-0 flex-1 text-gray-900 [overflow-wrap:anywhere] dark:text-white">
						{{ dept.name }}
						<span v-if="requestName(dept, req)" class="text-gray-500 dark:text-gray-400"> · {{ requestName(dept, req) }}</span>
						<span v-if="req.note" class="block text-xs text-gray-500 dark:text-gray-400">{{ req.note }}</span>
					</span>
					<span class="text-xs tabular-nums text-gray-500 dark:text-gray-400">{{ req.lineCount }} dòng</span>
					<span :class="['rounded-full px-2 py-0.5 text-xs font-medium', supplyStatusMeta(req.status).class]">
						{{ supplyStatusLabel(req.status, req.lineCount) }}
					</span>
					<CommonAppButton
						size="sm"
						:variant="actionLabel(req) === 'Xem' ? 'ghost' : 'outline'"
						:aria-label="`${actionLabel(req)} phiếu ${dept.name}${requestName(dept, req) ? `, ${requestName(dept, req)}` : ''}`"
						@click="emit('open', req.id)"
					>
						{{ actionLabel(req) }}
					</CommonAppButton>
				</li>
				<li v-if="!dept.requests.length" class="py-1.5 text-sm text-gray-500 dark:text-gray-400">
					{{ dept.name }} · chưa có phiếu
				</li>
			</template>
		</ul>
	</section>
</template>
