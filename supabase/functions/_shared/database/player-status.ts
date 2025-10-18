/**
 * Update player status to CONFIRMED in the database
 * @param supabase - Supabase client instance
 * @param userId - User ID to update status for
 * @param eventId - Event ID to update status for
 * @returns Promise<boolean> - True if status was successfully updated
 */
export async function updatePlayerStatus(
  supabase: any,
  userId: string,
  eventId: string
): Promise<boolean> {
  console.log(`Updating player status to CONFIRMED for user ${userId} in event ${eventId}`);
  
  const { error } = await supabase
    .from("league_event_players")
    .update({ 
      status: 'CONFIRMED',
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId)
    .eq("event_id", eventId);

  if (error) {
    console.error("Failed to update player status:", error);
    return false;
  }

  console.log("Player status updated successfully");
  return true;
}