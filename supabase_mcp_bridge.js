import { createClient } from "@supabase/supabase-js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const SUPABASE_URL = "https://db.geofal.com.pe";
const SUPABASE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3ODY4NzY0MCwiZXhwIjo0OTM0MzYxMjQwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.eH_lLQ_RF3_Py_bLzjOI2iPrWyxzmcATlxkBzmwbU9A";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const server = new Server(
  {
    name: "mi-supabase-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query",
        description: "Run a read-only SELECT query using supabase.from() REST syntax or rpc",
        inputSchema: {
          type: "object",
          properties: {
            table: {
              type: "string",
              description: "The name of the table to query (e.g. 'recepcion', 'muestras_concreto', 'trazabilidad')"
            },
            select: {
              type: "string",
              description: "Comma-separated columns to select, default '*'",
              default: "*"
            },
            filters: {
              type: "object",
              description: "Query filters as key-value pairs (e.g. {'numero_recepcion': '1287-26'})"
            },
            limit: {
              type: "number",
              description: "Maximum number of rows to return",
              default: 10
            }
          },
          required: ["table"]
        }
      },
      {
        name: "insert",
        description: "Insert rows into a Supabase table",
        inputSchema: {
          type: "object",
          properties: {
            table: {
              type: "string",
              description: "The name of the table to insert into"
            },
            records: {
              type: "array",
              items: {
                type: "object"
              },
              description: "Array of objects to insert"
            }
          },
          required: ["table", "records"]
        }
      },
      {
        name: "update",
        description: "Update rows in a Supabase table",
        inputSchema: {
          type: "object",
          properties: {
            table: {
              type: "string",
              description: "The name of the table to update"
            },
            match: {
              type: "object",
              description: "The matching criteria to identify target rows (e.g. {'id': 123})"
            },
            values: {
              type: "object",
              description: "The new values to set"
            }
          },
          required: ["table", "match", "values"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const table = args?.table as string;

  try {
    if (name === "query") {
      const select = (args?.select as string) || "*";
      const limit = (args?.limit as number) || 10;
      let query = supabase.from(table).select(select).limit(limit);

      if (args?.filters) {
        const filters = args.filters as Record<string, any>;
        for (const [key, value] of Object.entries(filters)) {
          query = query.eq(key, value);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    }

    if (name === "insert") {
      const records = args?.records as any[];
      const { data, error } = await supabase.from(table).insert(records).select();
      if (error) throw error;
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    }

    if (name === "update") {
      const match = args?.match as Record<string, any>;
      const values = args?.values as Record<string, any>;
      
      let query = supabase.from(table).update(values);
      for (const [key, value] of Object.entries(match)) {
        query = query.eq(key, value);
      }
      
      const { data, error } = await query.select();
      if (error) throw error;
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: error.message || String(error) }]
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch(console.error);
