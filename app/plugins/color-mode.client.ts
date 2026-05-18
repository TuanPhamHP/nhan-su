export default defineNuxtPlugin(() => {
	const { init } = useColorMode();
	init();
});
