export interface WebhookPayload {
  type: string;
  table: string;
  record: Record<string, any>;
  old_record?: Record<string, any> | null;
}

export interface WebhookValidationResult {
  success: boolean;
  payload?: WebhookPayload;
  response?: Response;
}

/**
 * Validate webhook secret and parse payload
 * @param req - Request object
 * @param expectedSecret - Expected webhook secret
 * @param expectedType - Expected webhook type (default: "INSERT")
 * @param expectedTable - Expected table name
 * @returns Validation result with payload or error response
 */
export async function validateWebhook(
  req: Request,
  expectedSecret: string,
  expectedType: string = "INSERT",
  expectedTable?: string
): Promise<WebhookValidationResult> {
  // 1) Verify webhook secret
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  
  if (!token || token !== expectedSecret) {
    return {
      success: false,
      response: new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        status: 401
      })
    };
  }

  // 2) Parse payload
  let payload: WebhookPayload;
  try {
    payload = await req.json() as WebhookPayload;
  } catch (error) {
    return {
      success: false,
      response: new Response(JSON.stringify({
        error: "Invalid JSON payload"
      }), {
        status: 400
      })
    };
  }

  // 3) Validate payload structure
  if (payload.type !== expectedType) {
    return {
      success: false,
      response: new Response(JSON.stringify({
        ok: true,
        skipped: true,
        reason: `Expected type ${expectedType}, got ${payload.type}`
      }), {
        status: 200
      })
    };
  }

  if (expectedTable && payload.table !== expectedTable) {
    return {
      success: false,
      response: new Response(JSON.stringify({
        ok: true,
        skipped: true,
        reason: `Expected table ${expectedTable}, got ${payload.table}`
      }), {
        status: 200
      })
    };
  }

  return {
    success: true,
    payload
  };
}

/**
 * Create a standardized error response
 * @param error - Error message or details
 * @param status - HTTP status code (default: 500)
 * @returns Response object
 */
export function createErrorResponse(error: string, status: number = 500): Response {
  return new Response(JSON.stringify({
    error: "Request failed",
    details: error
  }), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

/**
 * Create a standardized success response
 * @param data - Response data
 * @returns Response object
 */
export function createSuccessResponse(data: any): Response {
  return new Response(JSON.stringify({
    ok: true,
    ...data
  }), {
    headers: {
      "Content-Type": "application/json"
    },
    status: 200
  });
}
