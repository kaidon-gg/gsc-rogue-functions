/**
 * Get Discord handle for a user from the database
 * @param supabase - Supabase client instance
 * @param userId - User ID to get Discord handle for
 * @returns Promise<string | null> - Discord handle or null if not found
 */
export async function getDiscordHandle(
  supabase: any,
  userId: string
): Promise<string | null> {
  console.log(`Getting Discord handle for user ${userId}`);
  
  // First try league_players table
  const { data: leaguePlayer } = await supabase
    .from("league_players")
    .select("discord_handle")
    .eq("user_id", userId)
    .maybeSingle();

  if (leaguePlayer?.discord_handle) {
    console.log(`Discord handle from league_players: ${leaguePlayer.discord_handle}`);
    return leaguePlayer.discord_handle;
  }

  // Fallback to app_users table
  const { data: appUser } = await supabase
    .from("app_users")
    .select("discord_handle")
    .eq("user_id", userId)
    .maybeSingle();

  if (appUser?.discord_handle) {
    console.log(`Discord handle from app_users: ${appUser.discord_handle}`);
    return appUser.discord_handle;
  }

  console.log("No Discord handle found");
  return null;
}