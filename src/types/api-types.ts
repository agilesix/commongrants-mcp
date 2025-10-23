/**
 * CommonGrants API type definitions
 */

export interface ApiMetadata {
	name: string;
	id: string;
	description?: string;
	category?: string;
	versions: string[];
	healthCheck?: string;
	status?: "active" | "deprecated" | "beta";
	authRequired?: boolean;
}

export interface ApiVersion {
	version: string;
	status: "current" | "deprecated" | "beta";
	releaseDate?: string;
	deprecationDate?: string;
}

export interface ApiVersionInfo {
	version: string;
	baseUrl: string;
	openApiUrl: string;
	healthCheck?: string;
	status: "current" | "deprecated" | "beta";
	isCurrent: boolean;
}

export interface ApiInfo extends ApiMetadata {
	openApiUrl: string;
	documentation?: string;
	contact?: {
		name?: string;
		email?: string;
		url?: string;
	};
	versionDetails?: ApiVersionInfo[];
}

export interface OpenAPISpec {
	openapi: string;
	info: {
		title: string;
		description?: string;
		version: string;
		contact?: {
			name?: string;
			email?: string;
			url?: string;
		};
	};
	servers: Array<{
		url: string;
		description?: string;
	}>;
	paths: Record<string, Record<string, OperationObject>>;
	components?: {
		schemas?: Record<string, SchemaObject>;
		securitySchemes?: Record<string, SecuritySchemeObject>;
	};
	security?: Array<Record<string, string[]>>;
	tags?: Array<{
		name: string;
		description?: string;
	}>;
}

export interface OperationObject {
	operationId?: string;
	summary?: string;
	description?: string;
	tags?: string[];
	parameters?: ParameterObject[];
	requestBody?: RequestBodyObject;
	responses: Record<string, ResponseObject>;
	security?: Array<Record<string, string[]>>;
	deprecated?: boolean;
}

export interface ParameterObject {
	name: string;
	in: "query" | "header" | "path" | "cookie";
	description?: string;
	required?: boolean;
	deprecated?: boolean;
	schema: SchemaObject;
	example?: any;
}

export interface RequestBodyObject {
	description?: string;
	required?: boolean;
	content: Record<string, MediaTypeObject>;
}

export interface ResponseObject {
	description: string;
	content?: Record<string, MediaTypeObject>;
	headers?: Record<string, HeaderObject>;
}

export interface MediaTypeObject {
	schema: SchemaObject;
	example?: any;
	examples?: Record<string, ExampleObject>;
}

export interface HeaderObject {
	description?: string;
	required?: boolean;
	schema: SchemaObject;
}

export interface ExampleObject {
	summary?: string;
	description?: string;
	value: any;
}

export interface SchemaObject {
	type?: string;
	format?: string;
	description?: string;
	properties?: Record<string, SchemaObject>;
	items?: SchemaObject;
	required?: string[];
	enum?: any[];
	pattern?: string;
	minLength?: number;
	maxLength?: number;
	minimum?: number;
	maximum?: number;
	example?: any;
	default?: any;
	nullable?: boolean;
	readOnly?: boolean;
	writeOnly?: boolean;
	$ref?: string;
	allOf?: SchemaObject[];
	oneOf?: SchemaObject[];
	anyOf?: SchemaObject[];
}

export interface SecuritySchemeObject {
	type: string;
	description?: string;
	name?: string;
	in?: string;
	scheme?: string;
	bearerFormat?: string;
}

export interface HealthCheckResponse {
	status: "UP" | "DOWN" | "UNKNOWN";
	timestamp?: string;
	details?: Record<string, any>;
}
