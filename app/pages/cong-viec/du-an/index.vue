<script setup lang="ts">
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import TaskProjectFormModal from '~/components/modules/tasks/TaskProjectFormModal.vue';
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskProject, TaskProjectDetail, TaskProjectStatus } from '~/types/tasks.types';
	import { taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * UI-03 Danh sách dự án: dự án mình là thành viên (ADMIN, Giám đốc thấy mọi dự án). Trạng thái rỗng có
	 * thêm nút Tạo dự án mẫu (D-Q4): dự án thử sẵn hai nhóm, sáu việc giao cho chính mình. Mỗi người một
	 * dự án mẫu; bấm lần hai thì máy chủ trả 409 kèm id dự án mẫu đang có, trang mở luôn dự án đó.
	 */
	useHead({ title: 'Dự án' });

	const service = useTasksService();
	const toast = useToast();
	const route = useRoute();
	const router = useRouter();
	const { canUse, canWrite } = useModuleAccess();
	const readOnly = computed(() => !canWrite('TASKS'));

	/** Trạng thái và từ khoá nằm trên đường dẫn: `status` (`CLOSED`, `all`; bỏ khi Đang chạy), `q`. */
	function setQuery(patch: Record<string, string | undefined>) {
		const next: Record<string, unknown> = { ...route.query, ...patch };
		for (const [k, v] of Object.entries(next)) if (v === undefined || v === '') delete next[k];
		router.replace({ query: next as Record<string, string> });
	}
	const status = computed<TaskProjectStatus | ''>({
		get: () => {
			const v = String(route.query.status ?? '');
			if (v === 'CLOSED') return 'CLOSED';
			return v === 'all' ? '' : 'ACTIVE';
		},
		set: v => setQuery({ status: v === 'ACTIVE' ? undefined : v || 'all' }),
	});
	const q = ref(String(route.query.q ?? ''));
	const projects = ref<TaskProject[]>([]);
	const total = ref(0);
	const page = ref(1);
	const loading = ref(true);
	const loadError = ref('');

	async function load(more = false) {
		if (!more) loading.value = true;
		loadError.value = '';
		try {
			const next = more ? page.value + 1 : 1;
			const res = await service.listProjects({ status: status.value || undefined, q: q.value.trim() || undefined, page: next, limit: 50 });
			projects.value = more ? [...projects.value, ...res.data] : res.data;
			total.value = res.meta.total;
			page.value = next;
		} catch (err) {
			loadError.value = taskErrorInfo(err, 'Chưa tải được danh sách dự án.').message;
		} finally {
			loading.value = false;
		}
	}

	let timer: ReturnType<typeof setTimeout> | null = null;
	watch(q, v => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			setQuery({ q: v.trim() || undefined });
			load();
		}, 350);
	});
	watch(status, () => load());
	onMounted(() => {
		if (canUse('TASKS')) load();
		else loading.value = false;
	});

	const showForm = ref(false);

	const creatingSample = ref(false);
	async function createSample() {
		creatingSample.value = true;
		try {
			const p = await service.createSampleProject();
			toast.success(`Đã tạo dự án mẫu ${p.code}`);
			router.push(`/cong-viec/du-an/${p.code}`);
		} catch (err) {
			const info = taskErrorInfo(err);
			const existing = (err as { data?: { error?: { details?: { projectId?: number } } } })?.data?.error?.details?.projectId;
			if (info.code === 'TASK_SAMPLE_EXISTS' && existing) {
				toast.info(info.message);
				try {
					const p = await service.getProject(existing);
					router.push(`/cong-viec/du-an/${p.code}`);
				} catch {
					// không mở được thì chỉ báo câu
				}
			} else toast.error(info.message);
		} finally {
			creatingSample.value = false;
		}
	}
	function onSaved(p: TaskProjectDetail) {
		showForm.value = false;
		router.push(`/cong-viec/du-an/${p.code}`);
	}

	const filtered = computed(() => !!q.value.trim() || status.value !== 'ACTIVE');
	const STATUS_TABS: Array<{ value: TaskProjectStatus | ''; label: string }> = [
		{ value: 'ACTIVE', label: 'Đang chạy' },
		{ value: 'CLOSED', label: 'Đã đóng' },
		{ value: '', label: 'Tất cả' },
	];
</script>

<template>
	<div class="space-y-4 pb-24">
		<UiPageHeader title="Dự án" description="Dự án gom các việc cùng một mục tiêu. Bạn thấy dự án mình là thành viên; người tạo dự án là quản lý dự án.">
			<CommonAppButton v-if="!readOnly" data-testid="project-create-open" @click="showForm = true">
				<Icon name="heroicons:plus" class="mr-1 h-4 w-4" />Tạo dự án
			</CommonAppButton>
		</UiPageHeader>
		<CommonAppModuleNotice module="TASKS" />

		<div class="flex flex-wrap items-center gap-2">
			<div class="flex rounded-lg bg-gray-100 p-0.5 text-sm dark:bg-gray-800" role="tablist" aria-label="Trạng thái dự án">
				<button
					v-for="t in STATUS_TABS"
					:key="t.label"
					type="button"
					role="tab"
					:aria-selected="status === t.value"
					class="rounded-md px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
					:class="status === t.value ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
					@click="status = t.value"
				>
					{{ t.label }}
				</button>
			</div>
			<div class="relative min-w-[12rem] flex-1">
				<Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" aria-hidden="true" />
				<input
					v-model="q"
					type="search"
					placeholder="Tìm theo tên hoặc mã dự án"
					aria-label="Tìm dự án"
					class="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
				/>
			</div>
		</div>

		<div v-if="loading" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
			<div v-for="i in 6" :key="i" class="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>
		<TaskEmptyState v-else-if="loadError" kind="error" title="Chưa tải được dự án" :description="loadError" action-label="Thử lại" @action="load()" />
		<TaskEmptyState
			v-else-if="!projects.length && filtered"
			kind="filtered"
			title="Không có dự án khớp bộ lọc"
			description="Bạn thử từ khoá khác hoặc xem cả dự án đã đóng."
			action-label="Xoá bộ lọc"
			@action="() => { q = ''; status = 'ACTIVE'; }"
		/>
		<TaskEmptyState
			v-else-if="!projects.length"
			kind="none"
			title="Bạn chưa ở trong dự án nào"
			description="Tạo dự án khi có nhiều việc cùng một mục tiêu, ví dụ thông quan một lô hàng hay chốt sổ tháng."
			:action-label="readOnly ? undefined : 'Tạo dự án'"
			:secondary-label="readOnly ? undefined : creatingSample ? 'Đang tạo…' : 'Tạo dự án mẫu'"
			@action="showForm = true"
			@secondary="!creatingSample && createSample()"
		/>
		<p v-if="!loading && !loadError && !projects.length && !filtered && !readOnly" class="-mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
			Dự án mẫu có sẵn nhóm việc, việc con và việc phải chờ để bạn thử đủ bốn cách xem. Thử xong thì xoá.
		</p>
		<ul v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="project-list">
			<li v-for="p in projects" :key="p.id">
				<NuxtLink
					:to="`/cong-viec/du-an/${p.code}`"
					class="block h-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900"
				>
					<div class="flex items-center justify-between gap-2">
						<span class="flex items-center gap-1.5">
							<span class="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{{ p.code }}</span>
							<span v-if="p.isSample" class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Mẫu</span>
						</span>
						<span
							class="rounded-full px-2 py-0.5 text-xs"
							:class="p.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'"
						>
							{{ p.statusLabel }}
						</span>
					</div>
					<h2 class="mt-2 line-clamp-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{{ p.name }}</h2>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						{{ p.openTaskCount }} việc đang mở · {{ p.memberCount }} thành viên<template v-if="p.department"> · {{ p.department.name }}</template>
					</p>
					<p v-if="p.myRoleLabel" class="mt-1 text-xs text-gray-500 dark:text-gray-400">Bạn là {{ p.myRoleLabel.toLowerCase() }}</p>
				</NuxtLink>
			</li>
		</ul>
		<div v-if="projects.length < total && !loading" class="text-center">
			<CommonAppButton variant="secondary" size="sm" @click="load(true)">Tải thêm</CommonAppButton>
		</div>

		<TaskProjectFormModal v-if="showForm" @close="showForm = false" @saved="onSaved" />
	</div>
</template>
