export type GeneralRequestStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ApproverStepStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WAITING';

export type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'select' | 'checkbox';

export type FieldDataSource = 'custom' | 'departments' | 'employees' | 'positions';

export interface FieldDefinition {
	key: string;
	label: string;
	type: FieldType;
	required: boolean;
	placeholder?: string;
	defaultValue?: string;
	options?: string[];
	dataSource?: FieldDataSource; // only for type === 'select'; 'custom' or undefined = manual options
}

export interface DocumentTemplateSummary {
	id: number;
	name: string;
	category: string;
}

export interface DocumentTemplateDetail {
	id: number;
	name: string;
	description: string | null;
	category: string;
	fields: FieldDefinition[];
	printTemplate: string;
	templateFileUrl: string | null;
	isActive: boolean;
	version: number;
	createdById: number;
	createdAt: string;
}

export interface ApproverStep {
	order: number;
	employeeId: number;
	fullName: string;
	status: ApproverStepStatus;
	approvedAt: string | null;
	note: string | null;
}

export interface RequestEmployee {
	id: number;
	fullName: string;
	employeeCode: string;
}

export interface RequestTemplateSummary {
	id: number;
	name: string;
	category: string;
}

export interface GeneralRequestResponse {
	id: number;
	title: string;
	status: GeneralRequestStatus;
	statusLabel: string;
	template: RequestTemplateSummary;
	fieldValues: Record<string, unknown>;
	printTemplate: string | null;
	approvers: ApproverStep[];
	currentApproverIndex: number;
	currentApprover: ApproverStep | null;
	printCount: number;
	printedAt: string | null;
	submittedAt: string | null;
	completedAt: string | null;
	employee: RequestEmployee;
	canEdit: boolean;
	canSubmit: boolean;
	canPrint: boolean;
	canCancel: boolean;
	cancelledAt: string | null;
	createdAt: string;
}

export interface SuggestedApprover {
	employeeId: number;
	fullName: string;
	role: string;
	level: number;
	isSuggested: true;
}

export interface CreateTemplateDto {
	name: string;
	category: string;
	description?: string;
	fields: FieldDefinition[];
	printTemplate: string;
}

export type UpdateTemplateDto = Partial<CreateTemplateDto>;

export interface CreateRequestDto {
	templateId: number;
	title: string;
	fieldValues: Record<string, unknown>;
}

export interface SaveDraftDto {
	fieldValues: Record<string, unknown>;
}

export interface SubmitRequestDto {
	approvers: Array<{ employeeId: number }>;
}

export interface ApproveRequestDto {
	note?: string;
}

export interface RejectRequestDto {
	note: string;
}

export interface QueryRequestParams {
	page?: number;
	limit?: number;
	status?: GeneralRequestStatus;
	templateId?: number;
	employeeId?: number;
}

export interface QueryTemplateParams {
	category?: string;
	isActive?: boolean;
}
