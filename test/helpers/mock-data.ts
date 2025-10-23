/**
 * Reusable mock data for tests
 */

import type { ApiMetadata, ApiInfo, OpenAPISpec } from "../../src/types/api-types.js";
import sampleApiSpec from "../fixtures/openapi-specs/sample-api.json";
import apiResponses from "../fixtures/responses/api-responses.json";

/**
 * Mock VA API metadata list
 */
export const mockApiList: ApiMetadata[] = [
	{
		id: "address-validation",
		name: "Address Validation",
		versions: ["v1"],
		description: "Validate and standardize mailing addresses",
		status: "active",
		category: "Benefits",
	},
	{
		id: "benefits-claims",
		name: "Benefits Claims",
		versions: ["v1", "v2"],
		description: "Manage veteran benefits claims",
		status: "active",
		category: "Benefits",
	},
	{
		id: "facilities",
		name: "VA Facilities",
		versions: ["v1"],
		description: "Find VA facilities and services",
		status: "active",
		category: "Facilities",
	},
	{
		id: "legacy-api",
		name: "Legacy API",
		versions: ["v1"],
		description: "Deprecated API for testing",
		status: "deprecated",
		category: "Legacy",
	},
];

/**
 * Mock detailed API info
 */
export const mockApiInfo: ApiInfo = {
	id: "address-validation",
	name: "Address Validation API",
	description: "Validate and standardize mailing addresses",
	versions: ["v1"],
	healthCheck: "https://api.va.gov/services/address-validation/v1/health",
	openApiUrl: "https://api.va.gov/services/address-validation/v1/openapi.json",
	status: "active",
	authRequired: true,
	category: "Benefits",
	documentation: "https://developer.va.gov/explore/verification/docs/address_validation",
	contact: {
		name: "VA API Support",
		email: "api@va.gov",
	},
};

/**
 * Mock OpenAPI specification
 */
export const mockOpenApiSpec: OpenAPISpec = sampleApiSpec as OpenAPISpec;

/**
 * Mock S3 bucket listing XML
 */
export const mockS3BucketListing = apiResponses.s3BucketListing;

/**
 * Mock API metadata response
 */
export const mockApiMetadataResponse = apiResponses.apiMetadata;

/**
 * Mock health check responses
 */
export const mockHealthCheckResponses = {
	up: apiResponses.healthCheckUp,
	success: apiResponses.healthCheckSuccess,
	down: apiResponses.healthCheckDown,
};

/**
 * Create a mock fetch response
 */
export function createMockResponse(data: any, status = 200, headers: Record<string, string> = {}): Response {
	const defaultHeaders = {
		"content-type": "application/json",
		...headers,
	};

	return new Response(JSON.stringify(data), {
		status,
		headers: defaultHeaders,
	});
}

/**
 * Create a mock fetch response for text/xml
 */
export function createMockXmlResponse(data: string, status = 200): Response {
	return new Response(data, {
		status,
		headers: {
			"content-type": "text/xml",
		},
	});
}

/**
 * Create a mock fetch error
 */
export function createMockError(message: string): Error {
	return new Error(message);
}

/**
 * Mock validation errors for testing
 */
export const mockValidationErrors = {
	requiredField: {
		field: "email",
		message: "Missing required field: email",
		type: "required" as const,
		path: "/",
		fixSuggestion: 'Add the required field "email" to the payload',
	},
	typeError: {
		field: "age",
		message: "Invalid type: expected integer",
		type: "type" as const,
		path: "/age",
		expected: "integer",
		fixSuggestion: "Change the field type to integer",
	},
	formatError: {
		field: "email",
		message: "Invalid format: expected email",
		type: "format" as const,
		path: "/email",
		expected: "email",
		fixSuggestion: 'Provide a valid email address (e.g., "user@example.com")',
	},
	patternError: {
		field: "ssn",
		message: "Does not match pattern: ^\\d{3}-\\d{2}-\\d{4}$",
		type: "pattern" as const,
		path: "/ssn",
		expected: "^\\d{3}-\\d{2}-\\d{4}$",
		fixSuggestion: 'Use format "XXX-XX-XXXX" (e.g., "123-45-6789")',
	},
	enumError: {
		field: "status",
		message: "Invalid value. Allowed values: active, inactive, pending",
		type: "enum" as const,
		path: "/status",
		expected: ["active", "inactive", "pending"],
	},
};

/**
 * Mock validation warnings
 */
export const mockValidationWarnings = {
	optionalField: {
		field: "phone",
		message: 'Optional field "phone" is not provided but may be useful',
		type: "optional" as const,
		suggestion: "Phone number for contact purposes",
	},
};

/**
 * Valid test payloads
 */
export const validPayloads = {
	simpleString: "test",
	email: {
		email: "user@example.com",
	},
	person: {
		firstName: "John",
		lastName: "Doe",
		ssn: "123-45-6789",
		phone: "555-123-4567",
		age: 35,
		email: "john.doe@example.com",
		website: "https://example.com",
		dateOfBirth: "1989-01-15",
		isVeteran: true,
		status: "active",
	},
	address: {
		street: "123 Main St",
		city: "Springfield",
		state: "IL",
		zip: "62701",
	},
};

/**
 * Invalid test payloads
 */
export const invalidPayloads = {
	missingRequired: {
		firstName: "John",
		// missing lastName and ssn
	},
	wrongType: {
		firstName: "John",
		lastName: "Doe",
		ssn: "123-45-6789",
		age: "thirty-five", // should be integer
	},
	invalidFormat: {
		email: "not-an-email",
	},
	invalidPattern: {
		firstName: "John",
		lastName: "Doe",
		ssn: "123456789", // should be XXX-XX-XXXX
	},
	invalidEnum: {
		firstName: "John",
		lastName: "Doe",
		ssn: "123-45-6789",
		status: "unknown", // should be active, inactive, or pending
	},
};
