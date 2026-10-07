<script setup lang="ts">
	import type { AgentTopUser } from '~/types/agent-analytics.types';

	const props = defineProps<{
		users: AgentTopUser[];
		/** Tổng của cả hệ thống — để tính phần trăm mỗi người chiếm bao nhiêu. */
		totalRequests: number;
		totalCost: number;
		/** Số người thực sự có phát sinh token. BE chỉ trả tối đa 50 dòng nên hai số này lệch nhau được. */
		totalUsers: number;
	}>();

	const emit = defineEmits<{ select: [user: AgentTopUser] }>();

	type SortKey = 'costUsd' | 'requests' | 'totalTokens';
	const sortBy = ref<SortKey>('costUsd');
	const keyword = ref('');

	const COLUMNS: { key: SortKey; label: string }[] = [
		{ key: 'requests', label: 'Lượt hỏi' },
		{ key: 'totalTokens', label: 'Token' },
		{ key: 'costUsd', label: 'Chi phí' },
	];

	const nf = new Intl.NumberFormat('vi-VN');
	const fmtTok = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : nf.format(n));
	const fmtUsd = (n: number) => (n === 0 ? '$0' : '$' + n.toFixed(n < 1 ? 4 : 2));

	const rows = computed(() => {
		const kw = keyword.value.trim().toLowerCase();
		const matched = kw
			? props.users.filter((u) =>
					[u.fullName, u.employeeCode ?? '', u.department ?? ''].some((f) =>
						f.toLowerCase().includes(kw),
					),
				)
			: props.users;
		// Bản sao rồi mới sort: sort tại chỗ sẽ xáo mảng của store/props
		return [...matched].sort((a, b) => b[sortBy.value] - a[sortBy.value]);
	});

	/** Phần trăm của cột đang sắp xếp — thanh bar luôn nói về đúng con số người ta đang nhìn. */
	function share(u: AgentTopUser): number {
		const top = rows.value[0];
		if (!top) return 0;
		const max = top[sortBy.value];
		return max > 0 ? Math.round((u[sortBy.value] / max) * 100) : 0;
	}

	function pctOfTotal(u: AgentTopUser): string {
		const whole = sortBy.value === 'requests' ? props.totalRequests : props.totalCost;
		const part = sortBy.value === 'requests' ? u.requests : u.costUsd;
		if (sortBy.value === 'totalTokens' || whole <= 0) return '';
		return Math.round((part / whole) * 1000) / 10 + '%';
	}
</script>

<template>
	<section class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
		<header class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
			<div class="min-w-0 flex-1">
				<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Ai đang dùng trợ lý</h3>
				<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
					{{ totalUsers }} người có phát sinh token trong khoảng đang lọc<template
						v-if="users.length < totalUsers"
						>, bảng hiện {{ users.length }} người tốn nhiều nhất</template
					>
					· bấm vào một dòng để xem chủ đề và nhịp hỏi của người đó.
				</p>
			</div>

			<input
				v-model="keyword"
				type="search"
				placeholder="Tìm tên, mã NV, phòng ban…"
				class="w-56 shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
			/>
		</header>

		<p v-if="!users.length" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
			Chưa có ai hỏi trợ lý trong khoảng thời gian này.
		</p>

		<p
			v-else-if="!rows.length"
			class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
		>
			Không tìm thấy ai khớp “{{ keyword }}”.
		</p>

		<div v-else class="max-h-[32rem] overflow-auto">
			<table class="w-full text-sm">
				<thead class="sticky top-0 z-10 bg-gray-50 text-xs text-gray-500 dark:bg-gray-900/80 dark:text-gray-400">
					<tr>
						<th class="w-10 px-4 py-2 text-left font-medium">#</th>
						<th class="px-2 py-2 text-left font-medium">Người dùng</th>
						<th
							v-for="col in COLUMNS"
							:key="col.key"
							scope="col"
							:aria-sort="sortBy === col.key ? 'descending' : 'none'"
							class="w-28 px-3 py-2 text-right font-medium"
						>
							<button
								type="button"
								:class="[
									'transition hover:text-brand-600',
									sortBy === col.key ? 'text-brand-600 dark:text-brand-400' : '',
								]"
								@click="sortBy = col.key"
							>
								{{ col.label }}
								<span v-if="sortBy === col.key">↓</span>
							</button>
						</th>
						<th class="w-40 px-4 py-2 text-left font-medium">Tỷ trọng</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 dark:divide-gray-700">
					<tr
						v-for="(u, i) in rows"
						:key="u.employeeId"
						tabindex="0"
						class="cursor-pointer transition hover:bg-gray-50 focus:bg-gray-50 focus:outline-none dark:hover:bg-gray-700/40 dark:focus:bg-gray-700/40"
						@click="emit('select', u)"
						@keydown.enter="emit('select', u)"
					>
						<td class="px-4 py-2.5 tabular-nums text-gray-400 dark:text-gray-500">{{ i + 1 }}</td>
						<td class="px-2 py-2.5">
							<p class="font-medium text-gray-800 dark:text-gray-100">{{ u.fullName }}</p>
							<p v-if="u.employeeCode || u.department" class="text-xs text-gray-400 dark:text-gray-500">
								{{ [u.employeeCode, u.department].filter(Boolean).join(' · ') }}
							</p>
						</td>
						<td class="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">
							{{ nf.format(u.requests) }}
						</td>
						<td class="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">
							{{ fmtTok(u.totalTokens) }}
						</td>
						<td class="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">
							{{ fmtUsd(u.costUsd) }}
						</td>
						<td class="px-4 py-2.5">
							<div class="flex items-center gap-2">
								<div class="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
									<div class="h-full rounded-full bg-brand-600" :style="{ width: `${share(u)}%` }" />
								</div>
								<span class="tabular-nums text-xs text-gray-500 dark:text-gray-400">
									{{ pctOfTotal(u) }}
								</span>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>
</template>
