export interface CheckInLocation {
	id: number;
	name: string;
	latitude: number;
	longitude: number;
	radiusMeters: number;
	isActive: boolean;
	createdAt: string;
}

export interface CreateCheckInLocationDto {
	name: string;
	latitude: number;
	longitude: number;
	radiusMeters: number;
}

export type UpdateCheckInLocationDto = Partial<CreateCheckInLocationDto>;
