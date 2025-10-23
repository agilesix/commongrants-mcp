/**
 * OpenAPI parsing utilities using @scalar/openapi-parser
 */

import { dereference } from "@scalar/openapi-parser";
import type { OpenAPISpec, OperationObject } from "../types/api-types.js";
import type { ApiSummary, EndpointInfo, EndpointDetails, SchemaInfo } from "../types/mcp-tools.js";

export class OpenAPIParser {
	private spec: any;
	private dereferenced: any;

	constructor(spec: OpenAPISpec) {
		this.spec = spec;
	}

	/**
	 * Dereference $ref pointers in the OpenAPI spec
	 */
	async dereference(): Promise<void> {
		if (!this.dereferenced) {
			const result = await dereference(this.spec);
			this.dereferenced = result.schema;
		}
	}

	/**
	 * Get high-level API summary
	 */
	async getSummary(): Promise<ApiSummary> {
		await this.dereference();

		const spec = this.dereferenced;
		const paths = spec.paths || {};

		// Count endpoints by tag
		const tagCounts = new Map<string, number>();
		let totalEndpoints = 0;

		for (const path in paths) {
			for (const method in paths[path]) {
				if (["get", "post", "put", "patch", "delete", "options", "head"].includes(method)) {
					totalEndpoints++;
					const operation = paths[path][method];
					const tags = operation.tags || ["untagged"];

					for (const tag of tags) {
						tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
					}
				}
			}
		}

		// Build tag info
		const tags = (spec.tags || []).map((tag: any) => ({
			name: tag.name,
			description: tag.description,
			endpointCount: tagCounts.get(tag.name) || 0,
		}));

		// Add untagged endpoints if any
		if (tagCounts.has("untagged")) {
			tags.push({
				name: "untagged",
				description: "Endpoints without tags",
				endpointCount: tagCounts.get("untagged") || 0,
			});
		}

		// Extract auth methods
		const authMethods: string[] = [];
		if (spec.security) {
			for (const secReq of spec.security) {
				authMethods.push(...Object.keys(secReq));
			}
		}

		return {
			title: spec.info.title,
			description: spec.info.description,
			version: spec.info.version,
			baseUrl: spec.servers?.[0]?.url || "",
			authMethods: authMethods.length > 0 ? authMethods : undefined,
			tags: tags.length > 0 ? tags : undefined,
			totalEndpoints,
			contact: spec.info.contact,
		};
	}

	/**
	 * List all endpoints with optional filtering
	 */
	async listEndpoints(options?: {
		tag?: string;
		method?: string;
		deprecated?: boolean;
	}): Promise<EndpointInfo[]> {
		await this.dereference();

		const spec = this.dereferenced;
		const paths = spec.paths || {};
		const endpoints: EndpointInfo[] = [];

		for (const path in paths) {
			for (const method in paths[path]) {
				if (!["get", "post", "put", "patch", "delete", "options", "head"].includes(method)) {
					continue;
				}

				const operation: OperationObject = paths[path][method];

				// Apply filters
				if (options?.tag && !(operation.tags || []).includes(options.tag)) {
					continue;
				}

				if (options?.method && method.toLowerCase() !== options.method.toLowerCase()) {
					continue;
				}

				// Treat undefined deprecated as false (not deprecated)
				if (options?.deprecated !== undefined) {
					const isDeprecated = operation.deprecated || false;
					if (isDeprecated !== options.deprecated) {
						continue;
					}
				}

				endpoints.push({
					path,
					method: method.toUpperCase(),
					operationId: operation.operationId,
					summary: operation.summary,
					description: operation.description,
					tags: operation.tags,
					deprecated: operation.deprecated,
				});
			}
		}

		return endpoints;
	}

	/**
	 * Get detailed information for a specific endpoint
	 */
	async getEndpointDetails(path: string, method: string): Promise<EndpointDetails | null> {
		await this.dereference();

		const spec = this.dereferenced;
		const pathObj = spec.paths?.[path];

		if (!pathObj) {
			return null;
		}

		const operation: OperationObject = pathObj[method.toLowerCase()];

		if (!operation) {
			return null;
		}

		// Build parameters
		const parameters = (operation.parameters || []).map((param: any) => ({
			name: param.name,
			in: param.in,
			required: param.required,
			description: param.description,
			schema: param.schema,
			example: param.example,
		}));

		// Build request body
		let requestBody;
		if (operation.requestBody) {
			const content = operation.requestBody.content || {};
			const contentType = Object.keys(content)[0];

			if (contentType) {
				requestBody = {
					required: operation.requestBody.required,
					description: operation.requestBody.description,
					contentType,
					schema: content[contentType].schema,
					example: content[contentType].example,
				};
			}
		}

		// Build responses
		const responses: Record<string, any> = {};
		for (const statusCode in operation.responses) {
			const response = operation.responses[statusCode];
			const content = response.content || {};
			const contentType = Object.keys(content)[0];

			responses[statusCode] = {
				description: response.description,
				contentType,
				schema: contentType ? content[contentType].schema : undefined,
				example: contentType ? content[contentType].example : undefined,
			};
		}

		return {
			path,
			method: method.toUpperCase(),
			operationId: operation.operationId,
			summary: operation.summary,
			description: operation.description,
			tags: operation.tags,
			deprecated: operation.deprecated,
			parameters: parameters.length > 0 ? parameters : undefined,
			requestBody,
			responses,
			security: operation.security,
		};
	}

	/**
	 * List all schemas in the API
	 */
	async listSchemas(): Promise<SchemaInfo[]> {
		await this.dereference();

		const spec = this.dereferenced;
		const schemas = spec.components?.schemas || {};
		const schemaList: SchemaInfo[] = [];

		for (const name in schemas) {
			const schema = schemas[name];

			schemaList.push({
				name,
				type: schema.type,
				description: schema.description,
				properties: schema.properties ? Object.keys(schema.properties) : undefined,
				required: schema.required,
				example: schema.example,
			});
		}

		return schemaList;
	}

	/**
	 * Get a specific schema by name
	 */
	async getSchema(name: string): Promise<any | null> {
		await this.dereference();

		const spec = this.dereferenced;
		return spec.components?.schemas?.[name] || null;
	}

	/**
	 * Search for operations by keyword
	 */
	async searchOperations(query: string): Promise<EndpointInfo[]> {
		await this.dereference();

		const spec = this.dereferenced;
		const paths = spec.paths || {};
		const endpoints: EndpointInfo[] = [];
		const lowerQuery = query.toLowerCase();

		for (const path in paths) {
			for (const method in paths[path]) {
				if (!["get", "post", "put", "patch", "delete", "options", "head"].includes(method)) {
					continue;
				}

				const operation: OperationObject = paths[path][method];

				// Search in path, summary, description, operationId, and tags
				const searchableText = [
					path,
					operation.summary || "",
					operation.description || "",
					operation.operationId || "",
					...(operation.tags || []),
				]
					.join(" ")
					.toLowerCase();

				if (searchableText.includes(lowerQuery)) {
					endpoints.push({
						path,
						method: method.toUpperCase(),
						operationId: operation.operationId,
						summary: operation.summary,
						description: operation.description,
						tags: operation.tags,
						deprecated: operation.deprecated,
					});
				}
			}
		}

		return endpoints;
	}

	/**
	 * Get raw OpenAPI spec (for version comparison)
	 */
	getRawSpec(): OpenAPISpec {
		return this.spec;
	}
}
