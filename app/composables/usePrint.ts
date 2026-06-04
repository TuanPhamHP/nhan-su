import type { GeneralRequestResponse } from '~/types/general-request.types';
import { useGeneralRequestService } from '~/services/general-request.service';

function buildHtml(template: string, fieldValues: Record<string, unknown>): string {
	let html = template;
	for (const [key, value] of Object.entries(fieldValues)) {
		html = html.replaceAll(`{{${key}}}`, String(value ?? ''));
	}
	return html;
}

function openPrintWindow(html: string): void {
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

export function usePrint() {
	const service = useGeneralRequestService();

	async function printRequest(requestId: number): Promise<void> {
		const response = await service.print(requestId);
		const { printTemplate, fieldValues } = response;
		if (!printTemplate) return;
		openPrintWindow(buildHtml(printTemplate, fieldValues));
	}

	function previewRequest(req: GeneralRequestResponse, templateHtml?: string | null): void {
		const html = templateHtml ?? req.printTemplate;
		if (!html) return;
		openPrintWindow(buildHtml(html, req.fieldValues));
	}

	return { printRequest, previewRequest };
}
