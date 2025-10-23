/**
 * Validation tools for payload validation and example generation
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../services/api-client.js";
import { OpenAPIParser } from "../services/openapi-parser.js";
import { Validator } from "../services/validator.js";
import { ExampleGenerator } from "../utils/example-generator.js";
import { ErrorFormatter } from "../utils/error-formatter.js";

/**
 * Ensure payload is an object, parsing JSON strings if needed
 * Handles MCP protocol serialization where complex objects may be sent as JSON strings
 */
function ensureObject(payload: any): any {
	// If payload is already an object (not string), return it
	if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
		return payload;
	}

	// If payload is a string, try to parse it as JSON
	if (typeof payload === 'string') {
		try {
			return JSON.parse(payload);
		} catch (error) {
			throw new Error(`Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	// If payload is null, undefined, or other primitive, return as-is
	// (Validator will handle type validation)
	return payload;
}

export function registerValidationTools(server: McpServer) {
	/**
	 * Validate request payload against OpenAPI schema
	 */
	server.tool(
		"validate_request_payload",
		"Validates a request payload against the API schema",
		{
			apiId: z.string().describe("The API ID"),
			version: z.string().describe("The API version"),
			path: z.string().describe("The endpoint path"),
			method: z.string().describe("The HTTP method"),
			payload: z.any().describe("The request payload to validate (JSON object)"),
		},
		async ({ apiId, version, path, method, payload }) => {
			try {
				const spec = await ApiClient.getOpenApiSpec(apiId, version);
				const parser = new OpenAPIParser(spec);

				const endpoint = await parser.getEndpointDetails(path, method);

				if (!endpoint) {
					return {
						content: [
							{
								type: "text",
								text: `Endpoint not found: ${method} ${path}`,
							},
						],
						isError: true,
					};
				}

				if (!endpoint.requestBody) {
					return {
						content: [
							{
								type: "text",
								text: `Endpoint ${method} ${path} does not accept a request body`,
							},
						],
						isError: true,
					};
				}

				// Validate against schema
				const schema = endpoint.requestBody.schema;

				// Parse payload if it's a JSON string
				const parsedPayload = ensureObject(payload);
				const result = Validator.validate(parsedPayload, schema);

				const output = ErrorFormatter.formatValidationResult(result);

				return {
					content: [{ type: "text", text: output }],
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);

				// Provide better error context for JSON parsing issues
				if (errorMessage.includes('Invalid JSON')) {
					return {
						content: [
							{
								type: "text",
								text: `Error: Payload must be a valid JSON object.\n\nReceived type: ${typeof payload}\n\n${errorMessage}`,
							},
						],
						isError: true,
					};
				}

				return {
					content: [
						{
							type: "text",
							text: `Error validating request: ${errorMessage}`,
						},
					],
					isError: true,
				};
			}
		},
	);

	/**
	 * Validate response payload against OpenAPI schema
	 */
	server.tool(
		"validate_response_payload",
		"Validates a response payload against the API schema",
		{
			apiId: z.string().describe("The API ID"),
			version: z.string().describe("The API version"),
			path: z.string().describe("The endpoint path"),
			method: z.string().describe("The HTTP method"),
			statusCode: z.string().describe("The response status code (e.g., '200', '400')"),
			payload: z.any().describe("The response payload to validate (JSON object)"),
		},
		async ({ apiId, version, path, method, statusCode, payload }) => {
			try {
				const spec = await ApiClient.getOpenApiSpec(apiId, version);
				const parser = new OpenAPIParser(spec);

				const endpoint = await parser.getEndpointDetails(path, method);

				if (!endpoint) {
					return {
						content: [
							{
								type: "text",
								text: `Endpoint not found: ${method} ${path}`,
							},
						],
						isError: true,
					};
				}

				const response = endpoint.responses[statusCode];

				if (!response) {
					return {
						content: [
							{
								type: "text",
								text: `Response ${statusCode} not defined for ${method} ${path}`,
							},
						],
						isError: true,
					};
				}

				if (!response.schema) {
					return {
						content: [
							{
								type: "text",
								text: `Response ${statusCode} for ${method} ${path} has no schema defined`,
							},
						],
					};
				}

				// Validate against schema
				// Parse payload if it's a JSON string
				const parsedPayload = ensureObject(payload);
				const result = Validator.validate(parsedPayload, response.schema);

				const output = ErrorFormatter.formatValidationResult(result);

				return {
					content: [{ type: "text", text: output }],
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);

				// Provide better error context for JSON parsing issues
				if (errorMessage.includes('Invalid JSON')) {
					return {
						content: [
							{
								type: "text",
								text: `Error: Payload must be a valid JSON object.\n\nReceived type: ${typeof payload}\n\n${errorMessage}`,
							},
						],
						isError: true,
					};
				}

				return {
					content: [
						{
							type: "text",
							text: `Error validating response: ${errorMessage}`,
						},
					],
					isError: true,
				};
			}
		},
	);

	/**
	 * Generate example payload from schema
	 */
	server.tool(
		"generate_example_payload",
		"Generates an example payload for an API endpoint",
		{
			apiId: z.string().describe("The API ID"),
			version: z.string().describe("The API version"),
			path: z.string().describe("The endpoint path"),
			method: z.string().describe("The HTTP method"),
			requiredOnly: z.boolean().optional().describe("Generate only required fields (default: false)"),
		},
		async ({ apiId, version, path, method, requiredOnly }) => {
			try {
				const spec = await ApiClient.getOpenApiSpec(apiId, version);
				const parser = new OpenAPIParser(spec);

				const endpoint = await parser.getEndpointDetails(path, method);

				if (!endpoint) {
					return {
						content: [
							{
								type: "text",
								text: `Endpoint not found: ${method} ${path}`,
							},
						],
						isError: true,
					};
				}

				if (!endpoint.requestBody) {
					return {
						content: [
							{
								type: "text",
								text: `Endpoint ${method} ${path} does not accept a request body`,
							},
						],
						isError: true,
					};
				}

				// Generate example
				const schema = endpoint.requestBody.schema;
				const example = ExampleGenerator.generate(schema, { requiredOnly });

				const output = [
					`Example request payload for ${method} ${path}:`,
					"",
					JSON.stringify(example, null, 2),
					"",
				];

				if (requiredOnly) {
					output.push("Note: This example includes only required fields.");
				} else {
					output.push("Note: This example includes both required and optional fields.");
				}

				return {
					content: [{ type: "text", text: output.join("\n") }],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error generating example: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);

	/**
	 * Get detailed validation rules for a specific field
	 */
	server.tool(
		"get_validation_rules",
		`Gets validation rules for an API endpoint or specific field.

This tool has two modes:

1. Schema Overview (no fieldPath): Returns high-level structure
   • Top-level type, required fields, and property list
   • Use this to understand the overall payload structure

2. Field Details (with fieldPath): Returns detailed validation rules
   • Type, format, pattern, allowed values, examples
   • Use dot-notation for nested fields (e.g., "data.attributes.type")
   • Perfect for understanding specific field requirements

Examples:
• fieldPath: "data.type" → Get rules for the type field
• fieldPath: "data.attributes.veteranIdentification.ssn" → Get SSN validation rules
• fieldPath: "data.attributes.mailingAddress.state" → Get state code rules`,
		{
			apiId: z.string().describe("The API ID"),
			version: z.string().describe("The API version"),
			path: z.string().describe("The endpoint path"),
			method: z.string().describe("The HTTP method"),
			requestOrResponse: z.enum(["request", "response"]).optional().describe("Whether to get request or response validation rules (default: request)"),
			fieldPath: z.string().optional().describe(`Dot-notation path to specific field for detailed rules.

Examples:
  • "data.type" - top-level field
  • "data.attributes.type" - nested field
  • "data.attributes.veteranIdentification.mailingAddress.state" - deeply nested field

Without fieldPath: Returns schema overview (type, required fields, property list)
With fieldPath: Returns detailed rules (pattern, enum values, format, examples)`),
		},
		async ({ apiId, version, path, method, requestOrResponse = "request", fieldPath }) => {
			try {
				const spec = await ApiClient.getOpenApiSpec(apiId, version);
				const parser = new OpenAPIParser(spec);

				const endpoint = await parser.getEndpointDetails(path, method);

				if (!endpoint) {
					return {
						content: [
							{
								type: "text",
								text: `Endpoint not found: ${method} ${path}`,
							},
						],
						isError: true,
					};
				}

				// Get schema based on requestOrResponse parameter
				let schema: any;
				if (requestOrResponse === "request") {
					if (!endpoint.requestBody) {
						return {
							content: [
								{
									type: "text",
									text: `Endpoint ${method} ${path} does not accept a request body`,
								},
							],
							isError: true,
						};
					}
					schema = endpoint.requestBody.schema;
				} else {
					// Response validation
					if (!endpoint.responses || !endpoint.responses["200"]) {
						return {
							content: [
								{
									type: "text",
									text: `Endpoint ${method} ${path} does not have a 200 response defined`,
								},
							],
							isError: true,
						};
					}
					if (!endpoint.responses["200"].schema) {
						return {
							content: [
								{
									type: "text",
									text: `Response 200 for ${method} ${path} has no schema defined`,
								},
							],
							isError: true,
						};
					}
					schema = endpoint.responses["200"].schema;
				}

				// If fieldPath is provided, navigate to that field
				let targetSchema = schema;
				if (fieldPath) {
					const parts = fieldPath.split(".");
					for (const part of parts) {
						if (targetSchema.properties && targetSchema.properties[part]) {
							targetSchema = targetSchema.properties[part];
						} else {
							return {
								content: [
									{
										type: "text",
										text: `Field not found: ${fieldPath}`,
									},
								],
								isError: true,
							};
						}
					}
				}

				// Format validation rules
				const output = [
					fieldPath
						? `🔍 Validation rules for field: ${fieldPath}`
						: `📋 Schema overview for ${method} ${path} (${requestOrResponse})`,
					"",
				];

				// Add helpful tip when fieldPath is not provided
				if (!fieldPath) {
					output.push("💡 Tip: Add 'fieldPath' parameter to get detailed rules for specific fields");
					output.push("   Example: fieldPath = \"data.attributes.type\"");
					output.push("");
				}

				if (targetSchema.type) {
					output.push(`Type: ${targetSchema.type}`);
				}

				if (targetSchema.description) {
					output.push(`Description: ${targetSchema.description}`);
				}

				if (targetSchema.format) {
					output.push(`Format: ${targetSchema.format}`);
				}

				if (targetSchema.pattern) {
					output.push(`Pattern: ${targetSchema.pattern}`);
				}

				if (targetSchema.enum) {
					output.push(`Allowed values: ${targetSchema.enum.join(", ")}`);
				}

				if (targetSchema.minLength !== undefined) {
					output.push(`Minimum length: ${targetSchema.minLength}`);
				}

				if (targetSchema.maxLength !== undefined) {
					output.push(`Maximum length: ${targetSchema.maxLength}`);
				}

				if (targetSchema.minimum !== undefined) {
					output.push(`Minimum value: ${targetSchema.minimum}`);
				}

				if (targetSchema.maximum !== undefined) {
					output.push(`Maximum value: ${targetSchema.maximum}`);
				}

				if (targetSchema.required && targetSchema.required.length > 0) {
					output.push(`Required fields: ${targetSchema.required.join(", ")}`);
				}

				if (targetSchema.properties) {
					const propNames = Object.keys(targetSchema.properties);
					output.push(`Properties (${propNames.length}): ${propNames.join(", ")}`);
				}

				if (targetSchema.example !== undefined) {
					output.push(`Example: ${JSON.stringify(targetSchema.example)}`);
				}

				return {
					content: [{ type: "text", text: output.join("\n") }],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error getting validation rules: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);
}
