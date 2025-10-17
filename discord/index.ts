import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, GuildMember, PresenceStatus } from 'discord.js';

/**
 * Interface for user check results
 */
interface UserCheckResult {
  target: string;
  resolved_user_id: string;
  in_guild: boolean;
  has_role: boolean;
  online_status: string;
  matched_by: string;
  display_name: string;
  username: string;
  global_name: string;
}

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * CONFIG
 * ──────────────────────────────────────────────────────────────────────────────
 * Provide the list of usernames to check. Because “username” can mean:
 * - Global username (user.username)
 * - Display name in the server (member.displayName)
 * - Global display name (user.globalName, if set)
 *
 * We’ll try to match against all three (case-insensitive).
 *
 * ⚠️ Most reliable is to use USER IDs if you have them.
 * If you do, set USE_IDS = true and fill TARGETS with those IDs instead.
 */
const USE_IDS = false;

/** Example targets by username or display name (case-insensitive) */
const TARGETS = [
'verygoodsantaman',
'Shacarlol',
'adryel6323',
'moshingfox',
'ArulogunB',
'magnus8975',
'slevin',
'ka_chan95',
'Thatmax',
'nicolas1999.',
'Spardle',
'zompizza',
'QuentinD.',
'TheMonio',
'DanielNhoato',
'Gordo',
];

/** Optional: if you have IDs, flip USE_IDS true and use these instead */
// const TARGETS = ['123456789012345678', '234567890123456789'];

const GUILD_ID = process.env.DISCORD_GUILD_ID;
const TOKEN = process.env.DISCORD_BOT_TOKEN;

const ROLE_NAME = process.env.ROLE_NAME || 'OP';

if (!TOKEN || !GUILD_ID) {
  console.error('Missing DISCORD_BOT_TOKEN or GUILD_ID in .env');
  process.exit(1);
}

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * CLIENT
 * ──────────────────────────────────────────────────────────────────────────────
 * Intents:
 *  - Guilds: to access guild data
 *  - GuildMembers: REQUIRED to fetch the full member list (privileged)
 *  - GuildPresences: REQUIRED to see online status (privileged)
 *    Note: If you can't enable these intents, comment them out
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,  // Enable this for member fetching
    GatewayIntentBits.GuildPresences // Enable this for online status
  ],
  partials: [Partials.GuildMember, Partials.User]
});

/**
 * Utility: case-insensitive "clean" helper
 */
const normalize = (s: any): string =>
  (s || '').toString().trim().toLowerCase();

/**
 * Get user's online status
 */
function getOnlineStatus(member: GuildMember | null): string {
  if (!member?.presence) return 'unknown';
  const status: PresenceStatus = member.presence.status;
  return status === 'online' ? 'online' : 
         status === 'idle' ? 'idle' : 
         status === 'dnd' ? 'dnd' : 
         status === 'offline' ? 'offline' : 'unknown';
}

/**
 * Returns true if a member matches the provided "nameish" string.
 * We check against:
 *   - member.user.username (global unique username)
 *   - member.displayName   (server nickname/display name)
 *   - member.user.globalName (user's global display name, if set)
 */
function memberMatchesNameish(member: GuildMember, target: string): boolean {
  const t = normalize(target);
  const u = member.user;
  const candidates = [
    normalize(u?.username),
    normalize(member?.displayName),
    normalize(u?.globalName)
  ].filter(Boolean);

  return candidates.includes(t);
}

/**
 * Main process:
 *  - login
 *  - fetch guild & members
 *  - resolve role by name
 *  - check each target
 */
client.once('clientReady', async () => {
  try {
    console.log(`🤖 Bot logged in as ${client.user?.tag}`);
    console.log(`🔍 Bot is in ${client.guilds.cache.size} guild(s)`);
    
    // List available guilds for debugging
    if (client.guilds.cache.size > 0) {
      console.log('📋 Available guilds:');
      client.guilds.cache.forEach(guild => {
        console.log(`  - ${guild.name} (ID: ${guild.id})`);
      });
    }
    
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error(`❌ Guild with ID ${GUILD_ID} not found. Make sure:`);
      console.error('  1. The bot is invited to the correct server');
      console.error('  2. The GUILD_ID in .env is correct');
      console.error('  3. The bot has the necessary permissions');
      process.exit(1);
    }
    
    console.log(`🔗 Connected to guild: ${guild.name} (${guild.id})`);

    // Fetch all members for reliable local search
    // Note: This requires Server Members Intent to be enabled in Discord Developer Portal
    console.log('📥 Attempting to fetch all members...');
    let members;
    try {
      members = await guild.members.fetch();
      console.log(`✅ Loaded ${members.size} members`);
    } catch (error) {
      console.error('❌ Failed to fetch members. This likely means:');
      console.error('  1. Server Members Intent is not enabled in Discord Developer Portal');
      console.error('  2. The bot lacks permissions to view members');
      console.error('');
      console.error('To fix this:');
      console.error('  1. Go to https://discord.com/developers/applications');
      console.error('  2. Select your bot application');
      console.error('  3. Go to Bot section');
      console.error('  4. Enable "Server Members Intent" under Privileged Gateway Intents');
      console.error('  5. Uncomment GuildMembers intent in the code');
      process.exit(1);
    }

    // Find the role by name (case-insensitive)
    const role = guild.roles.cache.find(
      (r: any) => normalize(r.name) === normalize(ROLE_NAME)
    );
    if (!role) {
      console.warn(
        `⚠️ Role "${ROLE_NAME}" not found in this server. Will still report membership, but role checks will be false.`
      );
    } else {
      console.log(`🎭 Role found: ${role.name} (${role.id})`);
    }

    // Build a map to speed up username lookups (by normalized tokens)
    // Keys: username, displayName, globalName
    const nameIndex = new Map();
    for (const m of members.values()) {
      const keys = new Set([
        normalize(m.user?.username),
        normalize(m.displayName),
        normalize(m.user?.globalName)
      ]);
      for (const key of keys) {
        if (!key) continue;
        if (!nameIndex.has(key)) nameIndex.set(key, []);
        nameIndex.get(key).push(m);
      }
    }

    const results: UserCheckResult[] = [];

    for (const target of TARGETS) {
      if (USE_IDS) {
        // ID path (most reliable)
        const member = members.get(target);
        const inGuild = Boolean(member);
        const hasRole = inGuild && role && member ? member.roles.cache.has(role.id) : false;
        const onlineStatus = member ? getOnlineStatus(member) : 'unknown';

        results.push({
          target,
          resolved_user_id: member?.user?.id || '',
          in_guild: inGuild,
          has_role: hasRole,
          online_status: onlineStatus,
          matched_by: 'id',
          display_name: member?.displayName || '',
          username: member?.user?.username || '',
          global_name: member?.user?.globalName || ''
        });
        continue;
      }

      // Name path: try direct index first
      const key = normalize(target);
      let matchedMembers = nameIndex.get(key) || [];

      // Fallback: brute-force check (covers edge cases and partial cache issues)
      if (matchedMembers.length === 0) {
        matchedMembers = members.filter((m: GuildMember) => memberMatchesNameish(m, target));
      }

      if (matchedMembers.length === 0) {
        // Not in guild or names don't match exactly
        results.push({
          target,
          resolved_user_id: '',
          in_guild: false,
          has_role: false,
          online_status: 'unknown',
          matched_by: 'none',
          display_name: '',
          username: '',
          global_name: ''
        });
      } else if (matchedMembers.length === 1) {
        const m = matchedMembers[0] || matchedMembers.values().next().value;
        const hasRole = role ? m.roles.cache.has(role.id) : false;
        const onlineStatus = getOnlineStatus(m);

        results.push({
          target,
          resolved_user_id: m.user.id,
          in_guild: true,
          has_role: hasRole,
          online_status: onlineStatus,
          matched_by: 'exact',
          display_name: m.displayName || '',
          username: m.user.username || '',
          global_name: m.user.globalName || ''
        });
      } else {
        // Multiple matches (e.g., same display name). We'll list one line per match.
        for (const m of matchedMembers) {
          const hasRole = role ? m.roles.cache.has(role.id) : false;
          const onlineStatus = getOnlineStatus(m);
          results.push({
            target,
            resolved_user_id: m.user.id,
            in_guild: true,
            has_role: hasRole,
            online_status: onlineStatus,
            matched_by: 'multiple',
            display_name: m.displayName || '',
            username: m.user.username || '',
            global_name: m.user.globalName || ''
          });
        }
      }
    }

    // Print a friendly report
    console.log('\n🧾 Results:');
    for (const r of results) {
      const nameShow = r.username || r.display_name || r.global_name || '(unknown)';
      const status = r.in_guild ? (r.has_role ? '✅ in guild + has role' : '🟨 in guild, no role') : '❌ not in guild';
      const onlineEmoji = r.online_status === 'online' ? '🟢' : 
                         r.online_status === 'idle' ? '🟡' : 
                         r.online_status === 'dnd' ? '🔴' : 
                         r.online_status === 'offline' ? '⚫' : '❔';
      console.log(`- ${r.target} → ${nameShow} [${status}] ${onlineEmoji} ${r.online_status}`);
    }

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    // Clean exit
    client.destroy();
    process.exit(0);
  }
});

client.login(TOKEN).catch((e: any) => {
  console.error('Failed to login:', e);
  process.exit(1);
});
