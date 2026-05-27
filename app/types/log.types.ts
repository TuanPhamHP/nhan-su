export type LogActorType = 'USER' | 'SYSTEM';
export type LogStatus = 'SUCCESS' | 'FAILURE';
export type LogTargetType = 'employee' | 'department' | 'position' | 'role';

export interface LogActor {
	type: LogActorType;
	id: number | null;
	name: string | null;
	email: string | null;
	role: string | null;
}

export interface SystemLog {
	id: number;
	createdAt: string;
	actor: LogActor;
	action: string;
	targetType: LogTargetType | string | null;
	targetId: number | null;
	payload: Record<string, unknown> | null;
	status: LogStatus;
	errorMessage: string | null;
}

export interface QueryLogParams {
	actorId?: number;
	actorType?: LogActorType;
	action?: string;
	targetType?: string;
	targetId?: number;
	status?: LogStatus;
	dateFrom?: string;
	dateTo?: string;
	page?: number;
	limit?: number;
}
