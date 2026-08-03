<script setup lang="ts">
	interface ImageItem {
		url: string;
		name: string;
	}

	defineProps<{
		images: ImageItem[];
	}>();

	const emit = defineEmits<{
		imageClick: [index: number];
	}>();

	function onClick(idx: number) {
		emit('imageClick', idx);
	}
</script>

<template>
	<!-- 1 ảnh: full width, cap chiều cao -->
	<div v-if="images.length === 1" class="rounded-xl overflow-hidden">
		<button type="button" class="block w-full p-0 bg-transparent" @click="onClick(0)">
			<img
				:src="images[0]!.url"
				:alt="images[0]!.name"
				class="w-full max-h-[500px] object-cover cursor-zoom-in"
			/>
		</button>
	</div>

	<!-- 2 ảnh: 2 cột vuông -->
	<div
		v-else-if="images.length === 2"
		class="grid grid-cols-2 gap-1 rounded-xl overflow-hidden"
	>
		<button
			v-for="(img, i) in images"
			:key="i"
			type="button"
			class="block p-0 bg-transparent aspect-square"
			@click="onClick(i)"
		>
			<img :src="img.url" :alt="img.name" class="w-full h-full object-cover cursor-zoom-in" />
		</button>
	</div>

	<!-- 3 ảnh: 1 trái tall + 2 phải xếp chồng -->
	<div
		v-else-if="images.length === 3"
		class="grid grid-cols-2 grid-rows-2 gap-1 h-[420px] rounded-xl overflow-hidden"
	>
		<button
			type="button"
			class="row-span-2 block p-0 bg-transparent overflow-hidden"
			@click="onClick(0)"
		>
			<img
				:src="images[0]!.url"
				:alt="images[0]!.name"
				class="w-full h-full object-cover cursor-zoom-in"
			/>
		</button>
		<button type="button" class="block p-0 bg-transparent overflow-hidden" @click="onClick(1)">
			<img
				:src="images[1]!.url"
				:alt="images[1]!.name"
				class="w-full h-full object-cover cursor-zoom-in"
			/>
		</button>
		<button type="button" class="block p-0 bg-transparent overflow-hidden" @click="onClick(2)">
			<img
				:src="images[2]!.url"
				:alt="images[2]!.name"
				class="w-full h-full object-cover cursor-zoom-in"
			/>
		</button>
	</div>

	<!-- 4+ ảnh: 2x2, overlay +N lên tile thứ 4 nếu tổng > 4 -->
	<div v-else-if="images.length >= 4" class="grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
		<button
			v-for="(img, i) in images.slice(0, 4)"
			:key="i"
			type="button"
			class="relative block p-0 bg-transparent aspect-square"
			@click="onClick(i)"
		>
			<img :src="img.url" :alt="img.name" class="w-full h-full object-cover cursor-zoom-in" />
			<div
				v-if="i === 3 && images.length > 4"
				class="absolute inset-0 bg-black/50 flex items-center justify-center"
			>
				<span class="text-white text-3xl font-semibold">+{{ images.length - 4 }}</span>
			</div>
		</button>
	</div>
</template>
