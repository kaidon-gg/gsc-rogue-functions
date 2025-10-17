// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleEmailFunction } from "../_shared/handlers/email-function-handler.ts";
import { fetchUserEventData, UserEventData } from "../_shared/database/user-event-data.ts";
import { createEventPaymentEmail } from "../_shared/email/event-payment-template.ts";
import { createSuccessResponse, validateWebhook } from "../_shared/utils/webhook.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL")!; // e.g. "Rogue League <hello@your-domain>"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EDGE_WEBHOOK_SECRET = Deno.env.get("EDGE_WEBHOOK_SECRET")!;

Deno.serve(async (req: Request) => {
  const validation = await validateWebhook(
    req,
    EDGE_WEBHOOK_SECRET,
    "UPDATE",
    "league_event_players"
  );

  if (!validation.success) {
    return validation.response!;
  }

  const payload = validation.payload!;
  const paymentStatus = payload.record?.payment_status;
  const previousStatus = payload.old_record?.payment_status;

  if (paymentStatus !== "PAID" || previousStatus === "PAID") {
    return createSuccessResponse({
      skipped: true,
      reason: "Payment status did not transition to PAID"
    });
  }

  return handleEmailFunction<UserEventData>(
    payload.record,
    {
      resendApiKey: RESEND_API_KEY,
      fromEmail: FROM_EMAIL,
      supabaseUrl: SUPABASE_URL,
      supabaseServiceKey: SUPABASE_SERVICE_ROLE_KEY
    },
    {
      expectedTable: "league_event_players",
      fetchData: async (supabaseUrl, supabaseServiceKey, record) => {
        const { event_id, user_id } = record;
        return fetchUserEventData(supabaseUrl, supabaseServiceKey, user_id, event_id);
      },
      createEmail: (data) => {
        const { subject, html } = createEventPaymentEmail({
          displayName: data.displayName,
          eventTitle: data.eventTitle,
          eventDateLocal: data.eventDateLocal,
          tournamentTitle: data.tournamentTitle,
          gameName: data.gameName
        });

        return {
          to: [data.userEmail],
          subject,
          html
        };
      }
    }
  );
});
