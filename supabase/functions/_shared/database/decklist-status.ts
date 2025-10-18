/**
 * Check if user has submitted a decklist for the event
 * @param supabase - Supabase client instance
 * @param userId - User ID to check decklist for
 * @param eventId - Event ID to check decklist for
 * @returns Promise<boolean> - True if user has submitted a valid decklist
 */
export async function checkDecklistStatus(
  supabase: any,
  userId: string,
  eventId: string
): Promise<boolean> {
  console.log(`Checking decklist status for user ${userId} in event ${eventId}`);
  
  const { data: player, error } = await supabase
    .from("league_event_players")
    .select("decklist")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error || !player) {
    console.log(`Player not found: ${error?.message}`);
    return false;
  }

  const hasDecklist = !!(player.decklist && player.decklist.trim().length > 0);
  console.log(`Decklist status: ${hasDecklist ? 'present' : 'missing'}`);
  return hasDecklist;
}