import {
  Client,
  GatewayIntentBits,
  Partials,
  GuildMember,
  PresenceStatus
} from 'discord.js';

const ONLINE_STATUSES: PresenceStatus[] = ['online', 'idle', 'dnd'];

const normalize = (value: unknown): string =>
  (value ?? '').toString().trim().toLowerCase();

const getOnlineStatus = (member: GuildMember | null): PresenceStatus | 'unknown' => {
  if (!member?.presence) return 'unknown';
  return member.presence.status;
};

const memberMatchesNameish = (member: GuildMember, target: string): boolean => {
  const normalizedTarget = normalize(target);
  const user = member.user;
  const candidates = [
    normalize(user?.username),
    normalize(member?.displayName),
    normalize(user?.globalName)
  ].filter(Boolean);

  return candidates.includes(normalizedTarget);
};

const memberHasMatchingRole = (
  member: GuildMember,
  roleIds: Set<string>,
  roleNames: Set<string>
): boolean => {
  if (roleIds.size === 0 && roleNames.size === 0) return false;

  for (const role of member.roles.cache.values()) {
    if (roleIds.has(role.id)) return true;
    if (roleNames.has(normalize(role.name))) return true;
  }

  return false;
};

interface BasePresenceOptions {
  token?: string;
  guildId?: string;
  roleNames?: string[];
  roleIds?: string[];
  useId?: boolean;
}

export interface ValidatePlayerPresenceOptions extends BasePresenceOptions {
  target: string;
}

export interface ValidatePlayersPresenceOptions extends BasePresenceOptions {
  targets: string[];
}

export interface PlayerPresenceResult {
  target: string;
  username: string;
  isMember: boolean;
  isRole: boolean;
  isPresent: boolean;
}

const createDiscordClient = (): Client => {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.GuildMember, Partials.User]
  });
};

export const validatePlayersPresence = async (
  options: ValidatePlayersPresenceOptions
): Promise<PlayerPresenceResult[]> => {
  const {
    targets,
    roleNames: providedRoleNames,
    roleIds: providedRoleIds,
    useId = false
  } = options;

  const token = options.token ?? process.env.DISCORD_BOT_TOKEN;
  const guildId = options.guildId ?? process.env.DISCORD_GUILD_ID;
  const defaultRole = process.env.ROLE_NAME ? [process.env.ROLE_NAME] : [];

  if (!token) {
    throw new Error('Missing Discord bot token. Provide via options.token or DISCORD_BOT_TOKEN.');
  }

  if (!guildId) {
    throw new Error('Missing guild ID. Provide via options.guildId or DISCORD_GUILD_ID.');
  }

  if (!targets || targets.length === 0) {
    throw new Error('Provide at least one target identifier (username or ID).');
  }

  const roleIds = new Set((providedRoleIds ?? []).filter(Boolean));
  const roleNames = new Set(
    (providedRoleNames ?? defaultRole).map(normalize).filter(Boolean)
  );

  const client = createDiscordClient();

  try {
    await client.login(token);

    const guild = await client.guilds.fetch(guildId);
    const members = await guild.members.fetch();

    return targets.map((target) => {
      const member = useId
        ? members.get(target)
        : members.find((m: GuildMember) => memberMatchesNameish(m, target));

      if (!member) {
        return {
          target,
          username: target,
          isMember: false,
          isRole: false,
          isPresent: false
        };
      }

      const username =
        member.user.globalName ||
        member.displayName ||
        member.user.username ||
        target;

      const status = getOnlineStatus(member);
      const isPresent = status !== 'unknown' && ONLINE_STATUSES.includes(status);
      const isRole = memberHasMatchingRole(member, roleIds, roleNames);

      return {
        target,
        username,
        isMember: true,
        isRole,
        isPresent
      };
    });
  } finally {
    client.destroy();
  }
};

export const validatePlayerPresence = async (
  options: ValidatePlayerPresenceOptions
): Promise<PlayerPresenceResult> => {
  const results = await validatePlayersPresence({
    ...options,
    targets: [options.target]
  });

  return results[0];
};
