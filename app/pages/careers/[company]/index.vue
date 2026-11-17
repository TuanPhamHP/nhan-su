<script setup lang="ts">
	import { useRecruitmentPublicService } from '~/services/recruitment-public.service';
	import { recruitErrorCode, recruitErrorMessage } from '~/utils/recruitment.utils';
	import { formatDate } from '~/utils/date';
	import type { PublicCareers } from '~/types/recruitment-public.types';

	/**
	 * Trang tuyển dụng công khai của một công ty (UI-13).
	 *
	 * Layout `public` chứ không phải `default`: đây là trang cho ỨNG VIÊN, mở được khi chưa
	 * đăng nhập, và người quản lý đang đăng nhập bấm link cũng phải thấy đúng trang này
	 * (xem nhánh sớm trong `role-layout.global.ts` và `auth.global.ts`).
	 */
	definePageMeta({ layout: 'public' });

	const route = useRoute();
	const service = useRecruitmentPublicService();

	const companyCode = computed(() => String(route.params.company ?? ''));

	const data = ref<PublicCareers | null>(null);
	const loading = ref(true);
	/** Mã công ty lạ, công ty ngừng phục vụ, module đã tắt — BE trả cùng một lỗi để không lộ công ty nào tồn tại. */
	const closed = ref(false);
	const errorMessage = ref('');

	async function load() {
		loading.value = true;
		closed.value = false;
		errorMessage.value = '';
		try {
			data.value = await service.careers(companyCode.value);
		} catch (e) {
			data.value = null;
			if (recruitErrorCode(e) === 'RECRUIT_CAREERS_CLOSED') closed.value = true;
			else errorMessage.value = recruitErrorMessage(e, 'Không tải được trang tuyển dụng');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	useHead(() => ({
		title: data.value ? `Tuyển dụng — ${data.value.company.name}` : 'Tuyển dụng',
	}));
</script>

<template>
	<div class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
		<div v-if="loading" class="space-y-4">
			<div class="h-8 w-2/3 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
			<div class="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
			<div v-for="i in 3" :key="i" class="h-28 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="closed"
			class="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900"
		>
			<h1 class="text-lg font-semibold text-gray-900 dark:text-white">Không còn tuyển</h1>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
				Trang tuyển dụng này hiện không mở. Có thể đường dẫn đã cũ hoặc công ty đã kết thúc tuyển dụng.
			</p>
		</div>

		<div
			v-else-if="errorMessage"
			class="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900"
		>
			<p class="text-sm text-gray-600 dark:text-gray-400">{{ errorMessage }}</p>
			<CommonAppButton class="mt-4" variant="outline" @click="load">Thử lại</CommonAppButton>
		</div>

		<template v-else-if="data">
			<header class="mb-8">
				<p class="text-sm font-medium text-brand-600 dark:text-brand-400">Tuyển dụng</p>
				<h1 class="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
					{{ data.company.name }}
				</h1>
				<p
					v-if="data.intro"
					class="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-600 sm:text-base dark:text-gray-300"
				>
					{{ data.intro }}
				</p>
			</header>

			<p v-if="!data.jobs.length" class="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
				Hiện chưa có vị trí nào đang tuyển. Bạn ghé lại sau nhé.
			</p>

			<ul v-else class="space-y-3">
				<li v-for="job in data.jobs" :key="job.slug">
					<NuxtLink
						:to="`/careers/${companyCode}/${job.slug}`"
						class="block rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-brand-400 hover:bg-brand-50/40 sm:p-5 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-500 dark:hover:bg-gray-800"
					>
						<h2 class="text-base font-semibold text-gray-900 sm:text-lg dark:text-white">
							{{ job.title }}
						</h2>
						<dl class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
							<div class="flex items-center gap-1.5">
								<dt class="sr-only">Phòng ban</dt>
								<dd>{{ job.departmentName }}</dd>
							</div>
							<div v-if="job.locations.length" class="flex items-center gap-1.5">
								<dt class="sr-only">Nơi làm việc</dt>
								<dd>{{ job.locations.join(', ') }}</dd>
							</div>
							<div class="flex items-center gap-1.5">
								<dt class="sr-only">Loại hình</dt>
								<dd>{{ job.employmentTypeLabel }}</dd>
							</div>
						</dl>
						<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
							<span v-if="job.salaryText" class="font-medium text-brand-700 dark:text-brand-400">
								{{ job.salaryText }}
							</span>
							<span v-if="job.deadline" class="text-gray-500 dark:text-gray-400">
								Nhận hồ sơ đến {{ formatDate(job.deadline) }}
							</span>
						</div>
					</NuxtLink>
				</li>
			</ul>
		</template>
	</div>
</template>
