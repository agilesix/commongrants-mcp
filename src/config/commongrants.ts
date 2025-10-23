/**
 * CommonGrants API Configuration
 *
 * This file contains the configuration for accessing CommonGrants OpenAPI specifications.
 * Since CommonGrants doesn't have a discovery endpoint like VA Lighthouse's S3 bucket,
 * we maintain a static list of available API versions and their spec URLs.
 */

export interface CommonGrantsVersion {
	version: string;
	specUrl: string;
	description: string;
	status: "stable" | "latest" | "deprecated";
}

/**
 * Base URL for CommonGrants OpenAPI specifications
 */
export const COMMONGRANTS_BASE_URL = "https://commongrants.org";

/**
 * Available CommonGrants API versions
 * Ordered from newest to oldest
 */
export const COMMONGRANTS_VERSIONS: CommonGrantsVersion[] = [
	{
		version: "0.3.0",
		specUrl: "https://commongrants.org/openapi/openapi.0.3.0.yaml",
		description: "Latest version of CommonGrants API with expanded endpoints",
		status: "latest",
	},
	{
		version: "0.2.0",
		specUrl: "https://commongrants.org/openapi/openapi.0.2.0.yaml",
		description: "Stable version of CommonGrants API",
		status: "stable",
	},
];

/**
 * Get the spec URL for a specific version
 */
export function getSpecUrl(version: string): string | undefined {
	const versionConfig = COMMONGRANTS_VERSIONS.find((v) => v.version === version);
	return versionConfig?.specUrl;
}

/**
 * Get version information
 */
export function getVersionInfo(version: string): CommonGrantsVersion | undefined {
	return COMMONGRANTS_VERSIONS.find((v) => v.version === version);
}

/**
 * Get all available versions
 */
export function getAllVersions(): CommonGrantsVersion[] {
	return COMMONGRANTS_VERSIONS;
}

/**
 * Get the latest version
 */
export function getLatestVersion(): CommonGrantsVersion {
	const latest = COMMONGRANTS_VERSIONS.find((v) => v.status === "latest");
	if (!latest) {
		throw new Error("No latest version configured");
	}
	return latest;
}
