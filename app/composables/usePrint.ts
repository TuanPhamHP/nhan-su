import { useGeneralRequestService } from '~/services/general-request.service';

export function usePrint() {
	const service = useGeneralRequestService();

	async function printRequest(requestId: number): Promise<void> {
		const response = await service.print(requestId);
		const { printTemplate, fieldValues } = response;

		if (!printTemplate) return;

		let html = printTemplate;
		for (const [key, value] of Object.entries(fieldValues)) {
			html = html.replaceAll(`{{${key}}}`, String(value ?? ''));
		}

		const printWindow = window.open('', '_blank');
		if (!printWindow) return;

		printWindow.document.write(`
			<html>
				<head>
					<title>In tờ trình</title>
					<style>
						body { font-family: 'Times New Roman', serif; margin: 40px; line-height: 1.6; }
						@media print { .no-print { display: none; } }
					</style>
				</head>
				<body>
					${html}
					<div class="no-print" style="margin-top: 20px; text-align: center; padding: 16px; border-top: 1px solid #eee;">
						<button onclick="window.print()" style="margin-right: 8px; padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">In ngay</button>
						<button onclick="window.close()" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer;">Đóng</button>
					</div>
				</body>
			</html>
		`);
		printWindow.document.close();
		printWindow.focus();
	}

	return { printRequest };
}
