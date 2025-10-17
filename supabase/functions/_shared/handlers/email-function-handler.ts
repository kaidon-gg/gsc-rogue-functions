import { sendEmail } from "../email/send-email.ts";
import { validateWebhook, createErrorResponse, createSuccessResponse } from "../webhook.ts";

export interface EmailFunctionConfig {
  resendApiKey: string;
  fromEmail: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  webhookSecret: string;
}

export interface EmailFunctionHandler<T> {
  expectedTable: string;
  fetchData: (supabaseUrl: string, supabaseServiceKey: string, record: Record<string, any>) => Promise<{
    success: boolean;
    data?: T;
    error?: string;
  }>;
  createEmail: (data: T) => {
    to: string[];
    subject: string;
    html: string;
  };
}

/**
 * Generic email function handler that processes webhooks and sends emails
 * @param req - Request object
 * @param config - Email function configuration
 * @param handler - Handler with data fetching and email creation logic
 * @returns Response
 */
export async function handleEmailFunction<T>(
  req: Request,
  config: EmailFunctionConfig,
  handler: EmailFunctionHandler<T>
): Promise<Response> {
  try {
    // 1) Validate webhook
    const validation = await validateWebhook(
      req,
      config.webhookSecret,
      "INSERT",
      handler.expectedTable
    );

    if (!validation.success) {
      return validation.response!;
    }

    // 2) Fetch data using handler
    const fetchResult = await handler.fetchData(
      config.supabaseUrl,
      config.supabaseServiceKey,
      validation.payload!.record
    );

    if (!fetchResult.success || !fetchResult.data) {
      console.error("Data fetch error:", fetchResult.error);
      return createErrorResponse(
        `Failed to fetch required data: ${fetchResult.error}`,
        400
      );
    }

    // 3) Create email content using handler
    const emailContent = handler.createEmail(fetchResult.data);

    // 4) Send email
    const emailResult = await sendEmail(
      {
        from: config.fromEmail,
        ...emailContent
      },
      config.resendApiKey
    );

    if (!emailResult.success) {
      console.error("Email send error:", emailResult.error);
      return createErrorResponse(
        `Email send failed: ${emailResult.error}`,
        500
      );
    }

    return createSuccessResponse({
      email: emailResult.data
    });

  } catch (error) {
    console.error("Unhandled error", error);
    return createErrorResponse(
      `Unhandled error: ${String(error)}`,
      500
    );
  }
}