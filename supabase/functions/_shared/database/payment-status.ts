import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Check if user has paid for the event
 * @param supabase - Supabase client instance
 * @param userId - User ID to check payment for
 * @param eventId - Event ID to check payment for
 * @returns Promise<boolean> - True if user has paid or payment is free
 */
export async function checkPaymentStatus(
  supabase: any,
  userId: string,
  eventId: string
): Promise<boolean> {
  console.log(`Checking payment status for user ${userId} in event ${eventId}`);
  
  const { data: player, error } = await supabase
    .from("league_event_players")
    .select("payment_status, league_payment_id")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .single();

  if (error || !player) {
    console.log(`Player not found: ${error?.message}`);
    return false;
  }

  // Check if payment status is PAID or FREE
  if (player.payment_status === 'PAID' || player.payment_status === 'FREE') {
    console.log(`Payment status: ${player.payment_status}`);
    return true;
  }

  // Also check if there's a valid payment record
  if (player.league_payment_id) {
    const { data: payment } = await supabase
      .from("league_payments")
      .select("status")
      .eq("id", player.league_payment_id)
      .single();

    if (payment?.status === 'COMPLETE') {
      console.log("Payment found and complete");
      return true;
    }
  }

  console.log("Payment not complete or not found");
  return false;
}