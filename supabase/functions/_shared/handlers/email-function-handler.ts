import { sendEmail } from "../email/send-email.ts";
import { createErrorResponse, createSuccessResponse } from "../utils/webhook.ts";

export interface EmailFunctionConfig {
  resendApiKey: string;
  fromEmail: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
}

export interface EmailFunctionHandler<T> {
  expectedTable: string;
  fetchData: (supabaseUrl: string, supabaseServiceKey: string, record: Record<string, any>) => Promise<{
    success: boolean;
    data?: T;
    error?: string;
  }>;
  shouldSend?: (data: T) => boolean | Promise<boolean>;
  createEmail: (data: T) => {
    to: string[];
    subject: string;
    html: string;
  };
}

/**
 * Generic email function handler that processes webhooks and sends emails
 * @param record - Database record from the webhook payload
 * @param config - Email function configuration
 * @param handler - Handler with data fetching and email creation logic
 * @returns Response
 */
export async function handleEmailFunction<T>(
  record: Record<string, any>,
  config: EmailFunctionConfig,
  handler: EmailFunctionHandler<T>
): Promise<Response> {
  try {
    // 1) Fetch data using handler
    const fetchResult = await handler.fetchData(
      config.supabaseUrl,
      config.supabaseServiceKey,
      record
    );

    if (!fetchResult.success || !fetchResult.data) {
      console.error("Data fetch error:", fetchResult.error);
      return createErrorResponse(
        `Failed to fetch required data: ${fetchResult.error}`,
        400
      );
    }

    const data = fetchResult.data;
    const shouldSend = handler.shouldSend ? await handler.shouldSend(data) : true;
    if (!shouldSend) {
      // 2) Skip send when handler vetoes delivery
      console.info("Email send skipped by handler condition", {
        table: handler.expectedTable,
        record
      });
      return createSuccessResponse({
        skipped: true,
        reason: "Email send skipped by handler"
      });
    }

    // 3) Create email content using handler
    const emailContent = handler.createEmail(data);

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
