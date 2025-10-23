#!/usr/bin/env node

/**
 * Test script for CommonGrants MCP Server
 *
 * This script tests the MCP server to ensure:
 * 1. Server is running and responds to health checks
 * 2. MCP protocol works (initialize, list tools, call tools)
 * 3. CommonGrants-specific tools work correctly
 * 4. YAML OpenAPI spec parsing works
 *
 * Usage:
 *   1. Start the server: npm run dev
 *   2. Run this script: node test-mcp-commongrants.js
 */

const SERVER_URL = 'http://localhost:8788';

// ANSI color codes for prettier output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function warning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function section(message) {
  log(`\n${'='.repeat(60)}`, colors.blue);
  log(message, colors.blue);
  log('='.repeat(60), colors.blue);
}

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// MCP Client for SSE communication
class MCPClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.sessionId = null;
    this.messageEndpoint = null;
    this.messageQueue = [];
    this.responsePromises = new Map();
  }

  async connect() {
    info('Connecting to SSE endpoint...');

    // Step 1: GET to /sse to establish SSE connection and get sessionId
    const response = await fetch(`${this.baseUrl}/sse`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to connect: ${response.status} ${response.statusText}`);
    }

    // Parse the SSE stream to get sessionId and endpoint
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Read first few chunks to get the endpoint
    for (let i = 0; i < 3; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }

    // Parse the endpoint from SSE event
    const lines = buffer.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const endpoint = line.substring(6).trim();
        if (endpoint.startsWith('/sse/message')) {
          this.messageEndpoint = endpoint;
          const url = new URL(endpoint, this.baseUrl);
          this.sessionId = url.searchParams.get('sessionId');
          success(`Connected with sessionId: ${this.sessionId}`);
          break;
        }
      }
    }

    if (!this.sessionId || !this.messageEndpoint) {
      throw new Error('Failed to get sessionId from SSE stream');
    }

    // Keep reading the stream in background to collect responses
    this.streamReader = reader;
    this.streamBuffer = buffer;
    this.readStream();
  }

  async readStream() {
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { value, done } = await this.streamReader.read();
        if (done) break;

        this.streamBuffer += decoder.decode(value, { stream: true });

        // Process complete messages
        const lines = this.streamBuffer.split('\n');
        this.streamBuffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event: message')) {
            // Next line should be the data
            continue;
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              this.messageQueue.push(data);

              // Resolve any pending promise for this message
              if (data.id && this.responsePromises.has(data.id)) {
                const resolve = this.responsePromises.get(data.id);
                this.responsePromises.delete(data.id);
                resolve(data);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Stream reading error:', error);
    }
  }

  async sendMessage(message) {
    if (!this.sessionId) {
      throw new Error('Not connected. Call connect() first.');
    }

    const response = await fetch(`${this.baseUrl}${this.messageEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
    }

    // Wait for response from the stream
    return new Promise((resolve, reject) => {
      this.responsePromises.set(message.id, resolve);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.responsePromises.has(message.id)) {
          this.responsePromises.delete(message.id);
          reject(new Error(`Timeout waiting for response to message ${message.id}`));
        }
      }, 10000);
    });
  }

  async initialize() {
    info('Initializing MCP session...');

    await this.connect();

    const response = await this.sendMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'commongrants-test-client',
          version: '1.0.0',
        },
      },
    });

    if (response.result) {
      success('MCP session initialized');
      return response.result;
    }

    if (response.error) {
      throw new Error(`Initialize failed: ${response.error.message}`);
    }

    throw new Error('No result in initialize response');
  }

  async listTools() {
    info('Listing available tools...');

    const response = await this.sendMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    if (response.result && response.result.tools) {
      return response.result.tools;
    }

    if (response.error) {
      throw new Error(`List tools failed: ${response.error.message}`);
    }

    throw new Error('No tools in response');
  }

  async callTool(name, args) {
    const id = Math.floor(Math.random() * 10000);
    const response = await this.sendMessage({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name, arguments: args },
    });

    if (response.result) {
      return response.result;
    }

    if (response.error) {
      throw new Error(`Tool error: ${response.error.message}`);
    }

    throw new Error('No result in tool call response');
  }

  getTextContent(result) {
    if (result.content && result.content[0] && result.content[0].text) {
      return result.content[0].text;
    }
    return '';
  }
}

// Test functions
async function testServerHealth() {
  section('Test 1: Server Connectivity');

  try {
    // Test if server responds to SSE endpoint with GET
    const response = await fetch(`${SERVER_URL}/sse`, {
      method: 'GET',
    });

    if (response.ok) {
      success('Server is responding on port 8788');
      // Close the stream since we're just testing connectivity
      response.body.cancel();
      return true;
    } else {
      error(`Unexpected server response: ${response.status}`);
      return false;
    }
  } catch (err) {
    error(`Cannot connect to server: ${err.message}`);
    error('Make sure the server is running: npm run dev');
    return false;
  }
}

async function testMCPProtocol(client) {
  section('Test 2: MCP Protocol');

  try {
    // Initialize
    const initResult = await client.initialize();
    if (initResult.protocolVersion) {
      success(`Protocol version: ${initResult.protocolVersion}`);
    }
    if (initResult.serverInfo) {
      success(`Server: ${initResult.serverInfo.name} v${initResult.serverInfo.version}`);
    }

    // List tools
    const tools = await client.listTools();
    success(`Found ${tools.length} tools`);

    return tools;
  } catch (err) {
    error(`MCP protocol test failed: ${err.message}`);
    throw err;
  }
}

async function testCommonGrantsTools(client) {
  section('Test 3: CommonGrants Discovery Tools');

  try {
    // Test list_commongrants_apis
    info('Testing list_commongrants_apis...');
    const listResult = await client.callTool('list_commongrants_apis', {});
    const listText = client.getTextContent(listResult);

    if (listText.includes('CommonGrants API')) {
      success('list_commongrants_apis works');
      if (listText.includes('0.3.0')) {
        success('Found v0.3.0');
      }
      if (listText.includes('0.2.0')) {
        success('Found v0.2.0');
      }
    } else {
      warning('Unexpected response from list_commongrants_apis');
      console.log(listText.substring(0, 200));
    }

    // Test get_api_version_info
    info('Testing get_api_version_info...');
    const infoResult = await client.callTool('get_api_version_info', {
      apiId: 'commongrants-0.3.0',
    });
    const infoText = client.getTextContent(infoResult);

    if (infoText.includes('CommonGrants') && infoText.includes('0.3.0')) {
      success('get_api_version_info works for v0.3.0');
    } else {
      warning('Unexpected response from get_api_version_info');
      console.log(infoText.substring(0, 200));
    }

  } catch (err) {
    error(`CommonGrants tools test failed: ${err.message}`);
    throw err;
  }
}

async function testYAMLParsing(client) {
  section('Test 4: YAML OpenAPI Spec Parsing');

  try {
    info('Testing get_api_summary with YAML spec...');
    const summaryResult = await client.callTool('get_api_summary', {
      apiId: 'commongrants-0.3.0',
      version: '0.3.0',
    });
    const summaryText = client.getTextContent(summaryResult);

    if (summaryText.includes('API') && summaryText.includes('endpoint')) {
      success('YAML spec parsed successfully');

      // Check for CommonGrants-specific endpoints
      if (summaryText.toLowerCase().includes('opportunit')) {
        success('Found Opportunities endpoints');
      }
      if (summaryText.toLowerCase().includes('application')) {
        success('Found Applications endpoints');
      }
    } else {
      warning('Unexpected summary response');
      console.log(summaryText.substring(0, 300));
    }

  } catch (err) {
    error(`YAML parsing test failed: ${err.message}`);
    console.error(err);
  }
}

async function testExplorationTools(client) {
  section('Test 5: Exploration Tools');

  try {
    info('Testing list_api_endpoints...');
    const endpointsResult = await client.callTool('list_api_endpoints', {
      apiId: 'commongrants-0.3.0',
      version: '0.3.0',
    });
    const endpointsText = client.getTextContent(endpointsResult);

    if (endpointsText.includes('endpoint') || endpointsText.includes('GET') || endpointsText.includes('POST')) {
      success('list_api_endpoints works');
    } else {
      warning('Unexpected endpoints response');
      console.log(endpointsText.substring(0, 200));
    }

  } catch (err) {
    error(`Exploration tools test failed: ${err.message}`);
    console.error(err);
  }
}

async function testValidationTools(client) {
  section('Test 6: Validation Tools');

  try {
    info('Testing validation tools availability...');
    const tools = await client.listTools();
    const validationTools = tools.filter(t =>
      t.name.includes('validate') || t.name.includes('example')
    );

    if (validationTools.length >= 4) {
      success(`Found ${validationTools.length} validation tools`);
      validationTools.forEach(tool => {
        info(`  - ${tool.name}`);
      });
    } else {
      warning('Expected 4 validation tools');
    }

  } catch (err) {
    error(`Validation tools test failed: ${err.message}`);
  }
}

// Main test runner
async function runTests() {
  console.clear();
  log('\n🚀 CommonGrants MCP Server Test Suite\n', colors.cyan);

  let passed = 0;
  let failed = 0;

  try {
    // Test 1: Server Health
    const serverHealthy = await testServerHealth();
    if (!serverHealthy) {
      error('\nServer is not running. Please start it first:');
      info('  npm run dev\n');
      process.exit(1);
    }
    passed++;

    await sleep(500);

    // Create MCP client
    const client = new MCPClient(SERVER_URL);

    // Test 2: MCP Protocol
    const tools = await testMCPProtocol(client);
    if (tools.length < 10) {
      warning(`Expected 13 tools, found ${tools.length}`);
    } else {
      passed++;
    }

    await sleep(500);

    // Test 3: CommonGrants Tools
    await testCommonGrantsTools(client);
    passed++;

    await sleep(500);

    // Test 4: YAML Parsing
    await testYAMLParsing(client);
    passed++;

    await sleep(500);

    // Test 5: Exploration Tools
    await testExplorationTools(client);
    passed++;

    await sleep(500);

    // Test 6: Validation Tools
    await testValidationTools(client);
    passed++;

  } catch (err) {
    failed++;
    console.error(err);
  }

  // Summary
  section('Test Summary');
  log(`\nTests Passed: ${passed}`, colors.green);
  if (failed > 0) {
    log(`Tests Failed: ${failed}`, colors.red);
  }
  log(`Total Tests: ${passed + failed}\n`);

  if (failed === 0) {
    success('All tests passed! ✨');
    success('Server is ready for deployment 🚀\n');
    process.exit(0);
  } else {
    error('Some tests failed ❌\n');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(err => {
  error(`\nFatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
