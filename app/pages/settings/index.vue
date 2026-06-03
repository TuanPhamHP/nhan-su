<script setup lang="ts">
import TemplateFormModal from '~/components/modules/general-request/TemplateFormModal.vue';
import type { DocumentTemplateDetail } from '~/types/general-request.types';
import { useGeneralRequestService } from '~/services/general-request.service';

definePageMeta({ title: 'Cài đặt' });

const toast = useToast();
const { user } = useAuth();
const service = useGeneralRequestService();
const showTemplateTab = ref(false);
const templates = ref<DocumentTemplateDetail[]>([]);
const templatesLoading = ref(false);
const templateFormTarget = ref<DocumentTemplateDetail | undefined>(undefined);
const showTemplateForm = ref(false);

const canManageTemplates = computed(() => ['ADMIN', 'HR'].includes(user.value?.role ?? ''));

async function loadTemplates() {
	if (!canManageTemplates.value) return;
	templatesLoading.value = true;
	try {
		templates.value = await service.findTemplates();
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tải mẫu văn bản');
	} finally {
		templatesLoading.value = false;
	}
}

function openCreateTemplate() {
	templateFormTarget.value = undefined;
	showTemplateForm.value = true;
}

function openEditTemplate(t: DocumentTemplateDetail) {
	templateFormTarget.value = t;
	showTemplateForm.value = true;
}

function onTemplateSaved(t: DocumentTemplateDetail) {
	showTemplateForm.value = false;
	const idx = templates.value.findIndex(x => x.id === t.id);
	if (idx !== -1) templates.value.splice(idx, 1, t);
	else templates.value.unshift(t);
}

async function handleToggleTemplate(t: DocumentTemplateDetail) {
	const action = t.isActive ? 'vô hiệu hóa' : 'kích hoạt lại';
	if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} mẫu "${t.name}"?`)) return;
	try {
		const updated = await service.updateTemplate(t.id, { isActive: !t.isActive } as Parameters<typeof service.updateTemplate>[1]);
		const idx = templates.value.findIndex(x => x.id === t.id);
		if (idx !== -1) templates.value.splice(idx, 1, updated);
		toast.success(`Đã ${action} mẫu`);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
}

const categoryLabels: Record<string, string> = {
	PROPOSAL: 'Tờ trình BGĐ',
	PURCHASE: 'Mua sắm',
	REWARD: 'Khen thưởng',
	OTHER: 'Khác',
};

onMounted(() => {
	if (showTemplateTab.value) loadTemplates();
});

watch(showTemplateTab, v => { if (v) loadTemplates(); });

const settingsItems = [
	{
		label: 'Địa điểm chấm công',
		description: 'Quản lý địa điểm GPS cho phép nhân viên check-in. Cấu hình bán kính và gán nhân viên.',
		route: '/settings/locations',
		icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
		tag: 'Chấm công',
	},
	{
		label: 'Ca làm việc',
		description: 'Tạo khuôn ca, cấu hình giờ vào/ra và ngưỡng trễ. Phân ca theo tuần cho từng nhân viên.',
		route: '/settings/shifts',
		icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
		tag: 'Chấm công',
	},
	{
		label: 'Ngày lễ & Nghỉ bù',
		description: 'Quản lý ngày lễ quốc gia và ngày nghỉ bù. Tạo nhanh ngày lễ cố định hoặc thêm thủ công.',
		route: '/settings/holidays',
		icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
		tag: 'Nghỉ lễ',
	},
];
</script>

<template>
	<div class="space-y-6">
		<div>
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Cài đặt</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Quản lý cấu hình hệ thống</p>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			<NuxtLink
				v-for="item in settingsItems"
				:key="item.route"
				:to="item.route"
				class="group flex flex-col gap-3 p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-sm transition-all"
			>
				<div class="flex items-start justify-between gap-3">
					<div class="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/50 transition-colors">
						<svg class="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
						</svg>
					</div>
					<span class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
						{{ item.tag }}
					</span>
				</div>

				<div>
					<p class="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
						{{ item.label }}
					</p>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
						{{ item.description }}
					</p>
				</div>

				<div class="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-medium mt-auto">
					Mở cài đặt
					<svg class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
					</svg>
				</div>
			</NuxtLink>

			<!-- Template management card (HR/Admin only) -->
			<button
				v-if="canManageTemplates"
				class="group flex flex-col gap-3 p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-sm transition-all text-left"
				@click="showTemplateTab = !showTemplateTab"
			>
				<div class="flex items-start justify-between gap-3">
					<div class="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/50 transition-colors">
						<svg class="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
						</svg>
					</div>
					<span class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">Văn bản</span>
				</div>
				<div>
					<p class="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">Mẫu tờ trình</p>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">Quản lý mẫu văn bản nội bộ. Tạo mẫu với form động và HTML template in.</p>
				</div>
				<div class="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-medium mt-auto">
					{{ showTemplateTab ? 'Thu gọn' : 'Mở quản lý' }}
					<svg class="w-3.5 h-3.5 transition-transform" :class="showTemplateTab ? 'rotate-90' : 'group-hover:translate-x-0.5'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
					</svg>
				</div>
			</button>
		</div>

		<!-- Template management section -->
		<div v-if="showTemplateTab && canManageTemplates" class="space-y-4">
			<div class="flex items-center justify-between">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Quản lý mẫu tờ trình</h2>
				<CommonAppButton @click="openCreateTemplate">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
					</svg>
					Tạo mẫu mới
				</CommonAppButton>
			</div>

			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tên mẫu</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Danh mục</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Số trường</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Phiên bản</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Trạng thái</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thao tác</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-if="templatesLoading">
								<td colspan="6" class="px-4 py-8 text-center">
									<svg class="animate-spin w-5 h-5 mx-auto text-brand-500" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
								</td>
							</tr>
							<tr v-else-if="templates.length === 0">
								<td colspan="6" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">Chưa có mẫu nào</td>
							</tr>
							<tr v-for="t in templates" :key="t.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ t.name }}</p>
									<p v-if="t.description" class="text-xs text-gray-400 mt-0.5">{{ t.description }}</p>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-400">{{ categoryLabels[t.category] ?? t.category }}</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-400">{{ t.fields.length }} trường</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-400">v{{ t.version }}</td>
								<td class="px-4 py-3">
									<span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', t.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400']">
										{{ t.isActive ? 'Đang dùng' : 'Vô hiệu' }}
									</span>
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1">
										<button class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors" title="Chỉnh sửa" @click="openEditTemplate(t)">
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
										</button>
										<button class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" :title="t.isActive ? 'Vô hiệu hóa' : 'Kích hoạt lại'" @click="handleToggleTemplate(t)">
											<svg v-if="t.isActive" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
											<svg v-else class="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
										</button>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>

	<Teleport to="body">
		<TemplateFormModal
			v-if="showTemplateForm"
			:edit-target="templateFormTarget"
			@saved="onTemplateSaved"
			@close="showTemplateForm = false"
		/>
	</Teleport>
</template>
