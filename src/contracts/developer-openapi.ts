import { DEVELOPER_API_MEDIA_TYPE, DEVELOPER_API_VERSION } from "./developer-api.ts"

const errorResponse = {
  description: "The request failed. The response always uses the standard error envelope.",
  content: {
    [DEVELOPER_API_MEDIA_TYPE]: {
      schema: { $ref: "#/components/schemas/ErrorEnvelope" },
    },
  },
}

const authenticatedOperation = {
  security: [{ bearerApiKey: [] }],
  responses: {
    "400": errorResponse,
    "401": errorResponse,
    "403": errorResponse,
    "413": errorResponse,
    "429": errorResponse,
    "500": errorResponse,
    "502": errorResponse,
  },
}

export const DEVELOPER_OPENAPI_DOCUMENT = {
  openapi: "3.1.0",
  info: {
    title: "Themys Developer API",
    version: DEVELOPER_API_VERSION,
    description: "Versioned, machine-readable legal-document extraction and analysis for developers and LLM agents.",
  },
  servers: [{ url: "https://themys.ca", description: "Production" }],
  "x-themys-response-contract": {
    mediaType: DEVELOPER_API_MEDIA_TYPE,
    successDiscriminator: { propertyName: "ok", value: true },
    errorDiscriminator: { propertyName: "ok", value: false },
    instruction: "Read data only when ok is true. When ok is false, branch on error.code and retain requestId for support.",
  },
  paths: {
    "/api/extract": {
      post: {
        ...authenticatedOperation,
        operationId: "extractLegalDocument",
        summary: "Extract readable source text from a public legal-document URL",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["url"],
                properties: { url: { type: "string", format: "uri" } },
              },
            },
          },
        },
        responses: {
          ...authenticatedOperation.responses,
          "200": {
            description: "Extracted document",
            content: {
              [DEVELOPER_API_MEDIA_TYPE]: {
                schema: { $ref: "#/components/schemas/ExtractEnvelope" },
              },
            },
          },
        },
      },
    },
    "/api/analyze": {
      post: {
        ...authenticatedOperation,
        operationId: "analyzeLegalDocument",
        summary: "Analyze one legal document using the account's playbook, targets, strict mode, and jurisdiction",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AnalyzeRequest" },
            },
          },
        },
        responses: {
          ...authenticatedOperation.responses,
          "200": {
            description: "Grounded analysis and extraction",
            content: {
              [DEVELOPER_API_MEDIA_TYPE]: {
                schema: { $ref: "#/components/schemas/AnalyzeEnvelope" },
              },
            },
          },
        },
      },
    },
    "/api/analyze/batch": {
      post: {
        ...authenticatedOperation,
        operationId: "analyzeLegalDocumentBatch",
        summary: "Analyze one to five legal documents and preserve input order",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["items"],
                properties: {
                  items: {
                    type: "array",
                    minItems: 1,
                    maxItems: 5,
                    items: { $ref: "#/components/schemas/AnalyzeRequest" },
                  },
                },
              },
            },
          },
        },
        responses: {
          ...authenticatedOperation.responses,
          "200": {
            description: "Ordered per-item results; individual items may succeed or fail",
            content: {
              [DEVELOPER_API_MEDIA_TYPE]: {
                schema: { $ref: "#/components/schemas/BatchEnvelope" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerApiKey: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "tmys_ API key",
      },
    },
    schemas: {
      AnalyzeRequest: {
        type: "object",
        additionalProperties: false,
        oneOf: [{ required: ["url"] }, { required: ["text"] }],
        properties: {
          url: { type: "string", format: "uri", maxLength: 2048 },
          text: { type: "string", maxLength: 200000 },
          sourceUrl: { type: "string", format: "uri", maxLength: 2048 },
          domain: { type: "string", maxLength: 253 },
        },
      },
      AnalysisPolicy: {
        type: "object",
        required: ["mode", "targetClauses", "playbookId", "jurisdiction", "complianceEvidence", "notice"],
        properties: {
          mode: { type: "string", enum: ["standard", "strict_targets_only"] },
          targetClauses: { type: "array", items: { type: "string" } },
          playbookId: { type: "string" },
          jurisdiction: {
            type: "object",
            required: ["country", "state"],
            properties: {
              country: { type: ["string", "null"] },
              state: { type: ["string", "null"] },
            },
          },
          complianceEvidence: { const: "source_grounded" },
          notice: { const: "informational_not_legal_advice" },
        },
      },
      SuccessBase: {
        type: "object",
        required: ["schemaVersion", "requestId", "ok", "data"],
        properties: {
          schemaVersion: { const: DEVELOPER_API_VERSION },
          requestId: { type: "string" },
          ok: { const: true },
        },
      },
      ErrorEnvelope: {
        type: "object",
        additionalProperties: false,
        required: ["schemaVersion", "requestId", "ok", "error"],
        properties: {
          schemaVersion: { const: DEVELOPER_API_VERSION },
          requestId: { type: "string" },
          ok: { const: false },
          error: {
            type: "object",
            required: ["code", "message", "status"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              status: { type: "integer" },
              details: { type: "object", additionalProperties: true },
            },
          },
        },
      },
      ExtractEnvelope: {
        allOf: [
          { $ref: "#/components/schemas/SuccessBase" },
          {
            type: "object",
            properties: {
              data: {
                type: "object",
                required: ["text", "wordCount"],
                properties: {
                  text: { type: "string" },
                  wordCount: { type: "integer", minimum: 0 },
                },
              },
            },
          },
        ],
      },
      AnalyzeEnvelope: {
        allOf: [
          { $ref: "#/components/schemas/SuccessBase" },
          {
            type: "object",
            properties: {
              data: {
                type: "object",
                required: ["scanId", "summary", "flags", "clauses", "fullExtraction", "document", "analysisPolicy", "usage"],
                properties: {
                  scanId: { type: "string" },
                  summary: { type: "string" },
                  flags: { type: "array", items: { type: "object", additionalProperties: true } },
                  clauses: { type: "array", items: { type: "object", additionalProperties: true } },
                  fullExtraction: { type: "array", items: { type: "object", additionalProperties: true } },
                  document: { type: "object", additionalProperties: true },
                  analysisPolicy: { $ref: "#/components/schemas/AnalysisPolicy" },
                  usage: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        ],
      },
      BatchItemResult: {
        oneOf: [
          {
            type: "object",
            required: ["ok", "index", "cached", "result"],
            properties: {
              ok: { const: true },
              index: { type: "integer", minimum: 0 },
              cached: { type: "boolean" },
              result: { type: "object", additionalProperties: true },
            },
          },
          {
            type: "object",
            required: ["ok", "index", "error"],
            properties: {
              ok: { const: false },
              index: { type: "integer", minimum: 0 },
              error: {
                type: "object",
                required: ["code", "message", "status"],
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                  status: { type: "integer" },
                },
              },
            },
          },
        ],
      },
      BatchEnvelope: {
        allOf: [
          { $ref: "#/components/schemas/SuccessBase" },
          {
            type: "object",
            properties: {
              data: {
                type: "object",
                required: ["results", "summary", "usage"],
                properties: {
                  results: { type: "array", items: { $ref: "#/components/schemas/BatchItemResult" } },
                  summary: { type: "object", additionalProperties: true },
                  usage: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        ],
      },
    },
  },
} as const
