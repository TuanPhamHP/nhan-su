<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import RecruitInterviewFormModal from '~/components/modules/recruitment/RecruitInterviewFormModal.vue';
	import { recruitErrorMessage, INTERVIEW_STATUS_CLASS } from '~/utils/recruitment.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { RecruitmentInterview, RecruitmentJob } from '~/types/recruitment.types';

	definePageMeta({ title: 'Lịch phỏng vấn' });

	const toast = useToast();
	const service = useRecruitmentService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);

	const canManage = computed(() => canWrite('RECRUIT') && hasPermission('recruitment:manage'));

	/**
	 * Danh sách theo ngày thay vì lưới lịch: dự án chưa có thư viện lịch nào, và thêm thư
	 * viện mới phải hỏi người dùng trước. Khoảng xem tối đa 62 ngày theo giới hạn của API.
	 */
	type RangeKind = 'week' | 'month';
	const rangeKind = ref<RangeKind>('week');
	const anchor = ref(new Date());

	const filterJob = ref<number | undefined>(undefined);
	const filterInterviewer = ref<number | undefined>(undefined);

	const interviews = ref<RecruitmentInterview[]>([]);
	const jobs = ref<RecruitmentJob[]>([]);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const acting = ref(false);
	const editing = ref<RecruitmentInterview | null>(null);

	/** Đầu tuần tính từ thứ Hai, giống cách BE đếm "tuần này" ở trang tổng quan. */
	function startOfWeek(d: Date): Date {
		const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
		const dow = (copy.getDay() + 6) % 7;
		copy.setDate(copy.getDate() - dow);
		return copy;
	}

	const range = computed(() => {
		const a = anchor.value;
		if (rangeKind.value === 'week') {
			const from = startOfWeek(a);
			const to = new Date(from);
			to.setDate(to.getDate() + 7);
			return { from, to };
		}
		const from = new Date(a.getFullYear(), a.getMonth(), 1);
		const to = new Date(a.getFullYear(), a.getMonth() + 1, 1);
		return { from, to };
	});

	const rangeLabel = computed(() => {
		const { from, to } = range.value;
		const last = new Date(to.getTime() - 1);
		return rangeKind.value === 'week'
			? `${formatDate(from.toISOString())} – ${formatDate(last.toISOString())}`
			: `Tháng ${from.getMonth() + 1}/${from.getFullYear()}`;
	});

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			interviews.value = await service.findInterviews({
				from: range.value.from.toISOString(),
				to: range.value.to.toISOString(),
				jobId: filterJob.value,
				interviewerId: filterInterviewer.value,
			});
		} catch (e) {
			interviews.value = [];
			loadError.value = recruitErrorMessage(e, 'Không tải được lịch phỏng vấn');
		} finally {
			loading.value = false;
		}
	}

	onMounted(async () => {
		directoryStore.load().catch(() => {
			/* ô lọc người phỏng vấn rỗng, lịch vẫn chạy */
		});
		try {
			const res = await service.findJobs({ limit: 100 });
			jobs.value = res.data;
		} catch {
			// Ô lọc tin rỗng thì vẫn xem được toàn bộ lịch.
		}
		await load();
	});

	watch([rangeKind, anchor, filterJob, filterInterviewer], load);

	function shift(step: number) {
		const d = new Date(anchor.value);
		if (rangeKind.value === 'week') d.setDate(d.getDate() + step * 7);
		else d.setMonth(d.getMonth() + step);
		anchor.value = d;
	}

	const jobOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả tin' },
		...jobs.value.map(j => ({ value: j.id as number | undefined, label: `${j.code} · ${j.title}` })),
	]);

	const interviewerOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả người phỏng vấn' },
		...employees.value.map(e => ({ value: e.id as number | undefined, label: e.fullName })),
	]);

	/** Gom theo ngày địa phương để danh sách đọc như một cuốn lịch. */
	const byDay = computed(() => {
		const map = new Map<string, RecruitmentInterview[]>();
		for (const item of interviews.value) {
			const d = new Date(item.startAt);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			const list = map.get(key) ?? [];
			list.push(item);
			map.set(key, list);
		}
		return [...map.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([day, list]) => ({
				day,
				items: list.sort((a, b) => a.startAt.localeCompare(b.startAt)),
			}));
	});

	function timeLabel(item: RecruitmentInterview): string {
		const fmt = (iso: string) =>
			new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
		return `${fmt(item.startAt)} – ${fmt(item.endAt)}`;
	}

	async function run(action: () => Promise<unknown>, okMessage: string) {
		if (acting.value) return;
		acting.value = true;
		try {
			await action();
			toast.success(okMessage);
			await load();
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Thao tác thất bại'));
			await load();
		} finally {
			acting.value = false;
		}
	}

	const markDone = (id: number) =>
		run(() => service.setInterviewStatus(id, 'DONE'), 'Đã ghi nhận buổi đã diễn ra');
	const markNoShow = (id: number) =>
		run(() => service.setInterviewStatus(id, 'NO_SHOW'), 'Đã ghi nhận ứng viên vắng');
	const cancel = (id: number) =>
		run(() => service.cancelInterview(id), 'Đã huỷ buổi phỏng vấn và báo cho những người liên quan');
</script>

<template>
	<div class="space-y-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-xl font-bold text-gray-900 dark:text-white">Lịch phỏng vấn</h1>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					Các buổi phỏng vấn và thi tuyển trong khoảng đang xem
				</p>
			</div>
		</div>

		<CommonAppModuleNotice module="RECRUIT" />

		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="flex flex-wrap items-center gap-3">
				<div class="flex items-center gap-1 rounded-lg border border-gray-300 p-0.5 dark:border-gray-600">
					<button
						v-for="k in [
							{ id: 'week', label: 'Tuần' },
							{ id: 'month', label: 'Tháng' },
						]"
						:key="k.id"
						type="button"
						class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
						:class="
							rangeKind === k.id
								? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
								: 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
						"
						@click="rangeKind = k.id as 'week' | 'month'"
					>
						{{ k.label }}
					</button>
				</div>

				<div class="flex items-center gap-1">
					<button
						type="button"
						class="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
						aria-label="Khoảng trước"
						@click="shift(-1)"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
						</svg>
					</button>
					<p class="min-w-[12rem] text-center text-sm font-medium text-gray-900 dark:text-white">
						{{ rangeLabel }}
					</p>
					<button
						type="button"
						class="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
						aria-label="Khoảng sau"
						@click="shift(1)"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
					</button>
					<CommonAppButton variant="ghost" size="sm" @click="anchor = new Date()">Hôm nay</CommonAppButton>
				</div>

				<div class="ml-auto flex flex-wrap items-center gap-2">
					<div class="w-56">
						<UiSelect v-model="filterJob" :options="jobOptions" />
					</div>
					<div class="w-52">
						<UiSelect v-model="filterInterviewer" :options="interviewerOptions" />
					</div>
				</div>
			</div>
		</div>

		<div v-if="loading" class="space-y-3">
			<div v-for="i in 3" :key="i" class="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center dark:border-rose-800 dark:bg-rose-900/20"
		>
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
		</div>

		<div
			v-else-if="!byDay.length"
			class="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-gray-400 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500"
		>
			<svg class="mb-3 h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
				/>
			</svg>
			<p class="text-sm">Không có buổi phỏng vấn nào trong khoảng này</p>
			<p class="mt-1 text-xs">Đặt lịch từ bảng hồ sơ của một tin tuyển dụng.</p>
		</div>

		<div v-else class="space-y-4">
			<section
				v-for="group in byDay"
				:key="group.day"
				class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
			>
				<div class="border-b border-gray-100 bg-gray-50 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-800/50">
					<p class="text-sm font-semibold text-gray-900 dark:text-white">
						{{ formatDate(group.day) }} · {{ group.items.length }} buổi
					</p>
				</div>

				<ul class="divide-y divide-gray-100 dark:divide-gray-800">
					<li v-for="item in group.items" :key="item.id" class="px-4 py-3">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<p class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
										{{ timeLabel(item) }}
									</p>
									<RecruitChip :label="item.statusLabel" :tone="INTERVIEW_STATUS_CLASS[item.status]" />
									<RecruitChip
										:label="item.modeLabel"
										tone="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
									/>
								</div>

								<p class="mt-1 text-sm text-gray-900 dark:text-white">
									{{ item.candidate.fullName }}
									<span class="text-gray-500 dark:text-gray-400">
										· {{ item.job.title }} · vòng {{ item.stage.name }}
									</span>
								</p>

								<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
									Người phỏng vấn: {{ item.interviewers.map(i => i.fullName).join(', ') || '—' }}
								</p>

								<p v-if="item.location" class="text-xs text-gray-500 dark:text-gray-400">
									Địa điểm: {{ item.location }}
								</p>
								<a
									v-if="item.meetingUrl"
									:href="item.meetingUrl"
									target="_blank"
									rel="noopener"
									class="text-xs text-brand-600 hover:underline dark:text-brand-400"
								>
									Mở link họp
								</a>
								<p v-if="item.note" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
									{{ item.note }}
								</p>
							</div>

							<div class="flex flex-wrap items-center gap-2">
								<NuxtLink
									:to="`/management/recruitment/jobs/${item.job.id}`"
									class="text-xs text-brand-600 hover:underline dark:text-brand-400"
								>
									Mở tin
								</NuxtLink>
								<template v-if="canManage && item.status === 'SCHEDULED'">
									<CommonAppButton variant="ghost" size="sm" @click="editing = item">Đổi lịch</CommonAppButton>
									<CommonAppButton variant="ghost" size="sm" :disabled="acting" @click="markDone(item.id)">
										Đã diễn ra
									</CommonAppButton>
									<CommonAppButton variant="ghost" size="sm" :disabled="acting" @click="markNoShow(item.id)">
										Ứng viên vắng
									</CommonAppButton>
									<CommonAppButton
										variant="danger_outline"
										size="sm"
										:disabled="acting"
										@click="cancel(item.id)"
									>
										Huỷ buổi
									</CommonAppButton>
								</template>
								<template v-else-if="canManage && (item.status === 'DONE' || item.status === 'NO_SHOW')">
									<CommonAppButton
										variant="ghost"
										size="sm"
										:disabled="acting"
										@click="item.status === 'DONE' ? markNoShow(item.id) : markDone(item.id)"
									>
										{{ item.status === 'DONE' ? 'Đổi sang ứng viên vắng' : 'Đổi sang đã diễn ra' }}
									</CommonAppButton>
								</template>
							</div>
						</div>

						<p v-if="item.status === 'CANCELLED'" class="mt-1 text-xs text-gray-400">
							Buổi đã huỷ lúc {{ formatDateTime(item.updatedAt) }}, không sửa lại được.
						</p>
					</li>
				</ul>
			</section>
		</div>

		<RecruitInterviewFormModal
			v-if="editing"
			:interview="editing"
			:stage-kind="editing.stage.kind"
			@saved="
				editing = null;
				toast.success('Đã đổi lịch phỏng vấn');
				load();
			"
			@close="editing = null"
		/>
	</div>
</template>
