/**
 * Exploration tools for progressive OpenAPI spec discovery
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../services/api-client.js";
import { OpenAPIParser } from "../services/openapi-parser.js";

/**
 * Simplify a JSON schema based on detail level and max depth
 */
function simplifySchema(schema: any, detailLevel: string = "standard", maxDepth: number = 3, currentDepth: number = 0): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	// If we've exceeded max depth, return a simplified placeholder
	if (currentDepth >= maxDepth) {
		return {
			type: schema.type || 'object',
			'...': 'Use get_validation_rules with fieldPath to explore deeper',
		};
	}

	const simplified: any = {};

	// Always include type
	if (schema.type) {
		simplified.type = schema.type;
	}

	// Minimal: Only required fields and types
	if (detailLevel === 'minimal') {
		if (schema.required && schema.required.length > 0) {
			simplified.required = schema.required;
		}

		if (schema.properties) {
			simplified.properties = {};
			for (const [key, value] of Object.entries(schema.properties)) {
				const propSchema: any = value;
				simplified.properties[key] = {
					type: propSchema.type || 'unknown',
					required: schema.required?.includes(key) || false,
				};
			}
		}

		if (schema.enum) {
			simplified.enum = schema.enum;
		}

		return simplified;
	}

	// Standard: Include descriptions and examples, respect max depth
	if (detailLevel === 'standard') {
		if (schema.description) {
			simplified.description = schema.description;
		}

		if (schema.required && schema.required.length > 0) {
			simplified.required = schema.required;
		}

		if (schema.enum) {
			simplified.enum = schema.enum;
		}

		if (schema.example !== undefined) {
			simplified.example = schema.example;
		}

		if (schema.format) {
			simplified.format = schema.format;
		}

		if (schema.pattern) {
			simplified.pattern = schema.pattern;
		}

		if (schema.minLength !== undefined || schema.maxLength !== undefined) {
			if (schema.minLength !== undefined) simplified.minLength = schema.minLength;
			if (schema.maxLength !== undefined) simplified.maxLength = schema.maxLength;
		}

		if (schema.minimum !== undefined || schema.maximum !== undefined) {
			if (schema.minimum !== undefined) simplified.minimum = schema.minimum;
			if (schema.maximum !== undefined) simplified.maximum = schema.maximum;
		}

		if (schema.properties) {
			simplified.properties = {};
			for (const [key, value] of Object.entries(schema.properties)) {
				simplified.properties[key] = simplifySchema(value, detailLevel, maxDepth, currentDepth + 1);
			}
		}

		if (schema.items) {
			simplified.items = simplifySchema(schema.items, detailLevel, maxDepth, currentDepth + 1);
		}

		return simplified;
	}

	// Full: Return everything (current behavior)
	return schema;
}

/**
 * Format schema output based on detail level
 */
function formatSchemaOutput(schema: any, detailLevel: string, maxDepth: number): string {
	if (detailLevel === 'minimal') {
		const simplified = simplifySchema(schema, 'minimal', maxDepth);
		return formatMinimalSchema(simplified);
	}

	const simplified = simplifySchema(schema, detailLevel, maxDepth);
	return JSON.stringify(simplified, null, 2);
}

/**
 * Format minimal schema as a clean tree structure
 */
function formatMinimalSchema(schema: any, indent: string = '  '): string {
	const lines: string[] = [];

	if (schema.type) {
		lines.push(`Type: ${schema.type}`);
	}

	if (schema.required && schema.required.length > 0) {
		lines.push(`Required: ${schema.required.join(', ')}`);
	}

	if (schema.enum) {
		lines.push(`Allowed values: ${schema.enum.join(', ')}`);
	}

	if (schema.properties) {
		const required = schema.required || [];
		const optional = Object.keys(schema.properties).filter(k => !required.includes(k));

		if (required.length > 0) {
			lines.push(`Required fields (${required.length}): ${required.join(', ')}`);
		}

		if (optional.length > 0) {
			lines.push(`Optional fields (${optional.length}): ${optional.join(', ')}`);
		}
	}

	return lines.join('\n' + indent);
}

export function registerExplorationTools(server: McpServer) {
	/**
	 * Get high-level API summary
	 */
	server.tool(
		"get_api_summary",
		"Gets a comprehensive summary of an API including endpoints and schemas",
		{
			apiId: z.string().describe("The API ID"),
			version: z.string().describe("The API version (e.g., 'v1', 'v2')"),
		},
		async ({ apiId, version }) => {
			try {
				const spec = await ApiClient.getOpenApiSpec(apiId, version);
				const parser = new OpenAPIParser(spec);
				const summary = await parser.getSummary();

				const output = [
					`API: ${summary.title}`,
					`Version: ${summary.version}`,
					`Base URL: ${summary.baseUrl}`,
					"",
				];

				if (summary.description) {
					output.push(`Description: ${summary.description}`, "");
				}

				output.push(`Total Endpoints: ${summary.totalEndpoints}`, "");

				if (summary.authMethods && summary.authMethods.length > 0) {
					output.push(`Authentication Methods: ${summary.authMethods.join(", ")}`, "");
				}

				if (summary.tags && summary.tags.length > 0) {
					output.push(`Tags (${summary.tags.length}):`);
					for (const tag of summary.tags) {
						output.push(`  • ${tag.name} (${tag.endpointCount} endpoint${tag.endpointCount === 1 ? "" : "s"})`);
						if (tag.description) {
							output.push(`    ${tag.description}`);
						}
					}
					output.push("");
				}

				if (summary.contact) {
					output.push("Contact:");
					if (summary.contact.name) output.push(`  Name: ${summary.contact.name}`);
					if (summary.contact.email) output.push(`  Email: ${summary.contact.email}`);
					if (summary.contact.url) output.push(`  URL: ${summary.contact.url}`);
				}

				return {
					content: [{ type: "text", text: output.join("\n") }],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error getting API summary: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);

	/**
	 * List API endpoints with filtering
	 */
	server.tool(
		"list_api_endpoints",
		"Lists all endpoints for an API with optional filtering",
		{
			apiId: z.string().describe("The API ID"),
			version: z.string().describe("The API version"),
			tag: z.string().optional().describe("Filter by tag"),
			method: z.string().optional().describe("Filter by HTTP method (GET, POST, etc.)"),
			includeDeprecated: z.boolean().optional().describe("Include deprecated endpoints"),
		},
		async ({ apiId, version, tag, method, includeDeprecated }) => {
			try {
				const spec = await ApiClient.getOpenApiSpec(apiId, version);
				const parser = new OpenAPIParser(spec);

				const endpoints = await parser.listEndpoints({
					tag,
					method,
					deprecated: includeDeprecated ? undefined : false,
				});

				const output = [
					`Found ${endpoints.length} endpoint${endpoints.length === 1 ? "" : "s"}`,
				];

				if (tag) output.push(`(filtered by tag: ${tag})`);
				if (method) output.push(`(filtered by method: ${method})`);
				output.push("\n");

				for (const endpoint of endpoints) {
					const deprecated = endpoint.deprecated ? " [DEPRECATED]" : "";
					output.push(`${endpoint.method} ${endpoint.path}${deprecated}`);

					if (endpoint.summary) {
						output.push(`  Summary: ${endpoint.summary}`);
					}

					if (endpoint.operationId) {
						output.push(`  Operation ID: ${endpoint.operationId}`);
					}

					if (endpoint.tags && endpoint.tags.length > 0) {
						output.push(`  Tags: ${endpoint.tags.join(", ")}`);
					}

					output.push("");
				}

				return {
					content: [{ type: "text", text: output.join("\n") }],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error listing endpoints: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);

	/**
	 * Get detailed endpoint information
	 */
	server.tool(
		"get_endpoint_details",
		`Gets detailed information about a specific API endpoint.

Schema Detail Levels:
• minimal - Only required fields, types, and structure (fastest, prevents truncation)
• standard - Includes descriptions, examples, respects max_depth (default, balanced)
• full - Complete schema with all details (may truncate on complex endpoints)

Use minimal for quick structure overview, standard for most cases, full only when you need everything.`,
		{
			apiId: z.string().describe("The API ID"),
			version: z.string().describe("The API version"),
			path: z.string().describe("The endpoint path (e.g., '/veterans/{id}')"),
			method: z.string().describe("The HTTP method (GET, POST, PUT, PATCH, DELETE)"),
			detail_level: z.enum(["minimal", "standard", "full"]).optional().describe("Schema detail level (default: standard). Use 'minimal' to avoid truncation on complex endpoints."),
			max_depth: z.number().min(1).max(10).optional().describe("Maximum nesting depth for schemas (default: 3). Lower values prevent truncation."),
		},
		async ({ apiId, version, path, method, detail_level = "standard", max_depth = 3 }) => {
			try {
				const spec = await ApiClient.getOpenApiSpec(apiId, version);
				const parser = new OpenAPIParser(spec);

				const details = await parser.getEndpointDetails(path, method);

				if (!details) {
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

				const output = [
					`${details.method} ${details.path}`,
					"",
				];

				if (details.deprecated) {
					output.push("⚠️  DEPRECATED", "");
				}

				if (details.summary) {
					output.push(`Summary: ${details.summary}`, "");
				}

				if (details.description) {
					output.push(`Description: ${details.description}`, "");
				}

				if (details.operationId) {
					output.push(`Operation ID: ${details.operationId}`, "");
				}

				if (details.tags && details.tags.length > 0) {
					output.push(`Tags: ${details.tags.join(", ")}`, "");
				}

				// Parameters
				if (details.parameters && details.parameters.length > 0) {
					output.push(`Parameters (${details.parameters.length}):`);
					for (const param of details.parameters) {
						const required = param.required ? " (required)" : " (optional)";
						output.push(`  • ${param.name} (${param.in})${required}`);

						if (param.description) {
							output.push(`    ${param.description}`);
						}

						if (param.schema) {
							output.push(`    Type: ${param.schema.type || "any"}`);
						}

						if (param.example) {
							output.push(`    Example: ${JSON.stringify(param.example)}`);
						}
					}
					output.push("");
				}

				// Request Body
				if (details.requestBody) {
					const required = details.requestBody.required ? " (required)" : " (optional)";
					output.push(`Request Body${required}:`);

					if (details.requestBody.description) {
						output.push(`  ${details.requestBody.description}`);
					}

					output.push(`  Content-Type: ${details.requestBody.contentType}`);

					if (details.requestBody.schema) {
						const schemaOutput = formatSchemaOutput(details.requestBody.schema, detail_level, max_depth);
						output.push(`  Schema:\n${schemaOutput.split('\n').map(l => '    ' + l).join('\n')}`);
					}

					if (details.requestBody.example && detail_level !== 'minimal') {
						output.push(`  Example: ${JSON.stringify(details.requestBody.example, null, 2)}`);
					}

					output.push("");
				}

				// Responses
				output.push("Responses:");
				for (const [statusCode, response] of Object.entries(details.responses)) {
					output.push(`  ${statusCode}: ${response.description}`);

					if (response.contentType) {
						output.push(`    Content-Type: ${response.contentType}`);
					}

					if (response.schema) {
						const schemaOutput = formatSchemaOutput(response.schema, detail_level, max_depth);
						output.push(`    Schema:\n${schemaOutput.split('\n').map(l => '      ' + l).join('\n')}`);
					}

					if (response.example && detail_level !== 'minimal') {
						output.push(`    Example: ${JSON.stringify(response.example, null, 2)}`);
					}
				}

				output.push("");

				// Security
				if (details.security && details.security.length > 0) {
					output.push("Security:");
					for (const secReq of details.security) {
						for (const [scheme, scopes] of Object.entries(secReq)) {
							output.push(`  • ${scheme}${scopes.length > 0 ? `: ${scopes.join(", ")}` : ""}`);
						}
					}
				}

				return {
					content: [{ type: "text", text: output.join("\n") }],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error getting endpoint details: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);

	/**
	 * List or get API schemas
	 */
	server.tool(
		"get_api_schemas",
		`Lists reusable schema components defined in the OpenAPI specification.

⚠️  Important: This tool only returns schemas defined in the 'components/schemas' section of the OpenAPI spec. Some APIs define schemas inline within endpoint definitions instead of creating reusable components, which will result in 0 schemas returned.

If you need to see schemas for a specific endpoint:
• Use 'get_endpoint_details' to view inline request/response schemas
• Use 'get_validation_rules' to view detailed field validation rules

Returns: Array of schema names with type, description, and properties.`,
		{
			apiId: z.string().describe("The API ID"),
			version: z.string().describe("The API version"),
			schemaName: z.string().optional().describe("Optional: specific schema name to retrieve"),
		},
		async ({ apiId, version, schemaName }) => {
			try {
				const spec = await ApiClient.getOpenApiSpec(apiId, version);
				const parser = new OpenAPIParser(spec);

				if (schemaName) {
					// Get specific schema
					const schema = await parser.getSchema(schemaName);

					if (!schema) {
						return {
							content: [
								{
									type: "text",
									text: `Schema not found: ${schemaName}`,
								},
							],
							isError: true,
						};
					}

					const output = [
						`Schema: ${schemaName}`,
						"",
						JSON.stringify(schema, null, 2),
					];

					return {
						content: [{ type: "text", text: output.join("\n") }],
					};
				}

				// List all schemas
				const schemas = await parser.listSchemas();

				// Handle empty schema list with helpful message
				if (schemas.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: `No reusable schema components found in ${apiId} ${version}.

This API likely defines schemas inline within endpoint definitions rather than in a reusable components section.

To view schemas for this API:
• Use 'get_endpoint_details' with a specific endpoint path and method
• Use 'get_validation_rules' to see detailed field validation rules for request/response payloads`,
							},
						],
					};
				}

				const output = [
					`Found ${schemas.length} schema${schemas.length === 1 ? "" : "s"}:\n`,
				];

				for (const schema of schemas) {
					output.push(`• ${schema.name}`);

					if (schema.type) {
						output.push(`  Type: ${schema.type}`);
					}

					if (schema.description) {
						output.push(`  Description: ${schema.description}`);
					}

					if (schema.properties && schema.properties.length > 0) {
						output.push(`  Properties (${schema.properties.length}): ${schema.properties.join(", ")}`);
					}

					if (schema.required && schema.required.length > 0) {
						output.push(`  Required: ${schema.required.join(", ")}`);
					}

					output.push("");
				}

				return {
					content: [{ type: "text", text: output.join("\n") }],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error getting schemas: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);

	/**
	 * Search API operations by keyword
	 */
	server.tool(
		"search_api_operations",
		"Searches for API operations matching a query",
		{
			apiId: z.string().describe("The API ID"),
			version: z.string().describe("The API version"),
			query: z.string().describe("Search query (searches paths, summaries, descriptions, operation IDs, and tags)"),
		},
		async ({ apiId, version, query }) => {
			try {
				const spec = await ApiClient.getOpenApiSpec(apiId, version);
				const parser = new OpenAPIParser(spec);

				const results = await parser.searchOperations(query);

				const output = [
					`Found ${results.length} matching endpoint${results.length === 1 ? "" : "s"} for query: "${query}"\n`,
				];

				for (const endpoint of results) {
					const deprecated = endpoint.deprecated ? " [DEPRECATED]" : "";
					output.push(`${endpoint.method} ${endpoint.path}${deprecated}`);

					if (endpoint.summary) {
						output.push(`  Summary: ${endpoint.summary}`);
					}

					if (endpoint.operationId) {
						output.push(`  Operation ID: ${endpoint.operationId}`);
					}

					if (endpoint.tags && endpoint.tags.length > 0) {
						output.push(`  Tags: ${endpoint.tags.join(", ")}`);
					}

					output.push("");
				}

				if (results.length === 0) {
					output.push("No matching endpoints found. Try a different search query.");
				}

				return {
					content: [{ type: "text", text: output.join("\n") }],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error searching operations: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);
}
