/**
 * Discovery tools for listing and getting CommonGrants API information
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../services/api-client.js";
import type { ApiMetadata } from "../types/api-types.js";

export function registerDiscoveryTools(server: McpServer) {
	/**
	 * List all available CommonGrants API versions
	 */
	server.tool(
		"list_commongrants_apis",
		"Lists all available CommonGrants API versions with their metadata",
		{
			includeDeprecated: z.boolean().optional().describe("Include deprecated API versions in the results"),
		},
		async ({ includeDeprecated }) => {
			try {
				const apis = await ApiClient.listApis();

				// Filter deprecated if requested
				const filtered = includeDeprecated
					? apis
					: apis.filter((api) => api.status !== "deprecated");

				// Format output
				const output = [
					`Found ${filtered.length} CommonGrants API version${filtered.length === 1 ? "" : "s"}`,
					"",
				];

				for (const api of filtered) {
					output.push(`• ${api.name} (${api.id})`);

					if (api.description) {
						output.push(`  ${api.description}`);
					}

					if (api.status && api.status !== "active") {
						output.push(`  Status: ${api.status}`);
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
							text: `Error listing APIs: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);

	/**
	 * Get detailed information about a specific API version
	 */
	server.tool(
		"get_api_version_info",
		"Gets detailed information about a specific CommonGrants API version",
		{
			apiId: z.string().describe("The API ID (e.g., 'commongrants-0.3.0', 'commongrants-0.2.0')"),
		},
		async ({ apiId }) => {
			try {
				const apiInfo = await ApiClient.getApiMetadata(apiId);

				// Format output
				const output = [
					`API: ${apiInfo.name}`,
					`ID: ${apiInfo.id}`,
					"",
				];

				if (apiInfo.description) {
					output.push(`Description: ${apiInfo.description}`, "");
				}

				if (apiInfo.status) {
					output.push(`Status: ${apiInfo.status}`);
				}

				output.push("");

				// Display version details if available
				if (apiInfo.versionDetails && apiInfo.versionDetails.length > 0) {
					output.push(`Version Details:\n`);

					for (const version of apiInfo.versionDetails) {
						// Add marker for current version
						const marker = version.isCurrent ? " (latest)" : "";
						output.push(`  ${version.version}${marker}`);

						if (version.baseUrl) {
							output.push(`    Base URL: ${version.baseUrl}`);
						}

						output.push(`    OpenAPI Spec: ${version.openApiUrl}`);

						if (version.status === "deprecated") {
							output.push(`    Status: deprecated`);
						}

						output.push(""); // Blank line between versions
					}
				} else {
					// Fallback to simple version list if versionDetails not available
					if (apiInfo.versions && apiInfo.versions.length > 0) {
						output.push(`Version: ${apiInfo.versions.join(", ")}`);
						output.push("");
					}

					if (apiInfo.openApiUrl) {
						output.push(`OpenAPI Spec: ${apiInfo.openApiUrl}`);
					}
				}

				if (apiInfo.documentation) {
					output.push(`Documentation: ${apiInfo.documentation}`);
				}

				if (apiInfo.contact) {
					output.push("", "Contact:");

					if (apiInfo.contact.name) {
						output.push(`  Name: ${apiInfo.contact.name}`);
					}

					if (apiInfo.contact.email) {
						output.push(`  Email: ${apiInfo.contact.email}`);
					}

					if (apiInfo.contact.url) {
						output.push(`  URL: ${apiInfo.contact.url}`);
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
							text: `Error getting API info: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);
}
