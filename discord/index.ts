import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { validatePlayersPresence } from './validate-player-presence.js';

export { validatePlayerPresence, validatePlayersPresence } from './validate-player-presence.js';

const usage = (): string => {
  return [
    'Usage: npm run discord -- <username-or-id>... [--role <name>]... [--use-id]',
    '',
    'Positional arguments:',
    '  <username-or-id>  One or more usernames, display names, or user IDs to validate',
    '',
    'Flags:',
    '  --role <name>      Role name to check (repeatable; defaults to ROLE_NAME env)',
    '  --use-id           Treat the target as a Discord user ID'
  ].join('\n');
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const roleNames: string[] = [];
  const positional: string[] = [];
  let useId = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--use-id' || arg === '--id') {
      useId = true;
    } else if (arg === '--role') {
      const value = args[i + 1];
      if (!value || value.startsWith('--')) {
        console.error('Expected a role name after --role');
        console.error(usage());
        process.exit(1);
      }
      roleNames.push(value);
      i += 1;
    } else if (arg.startsWith('--role=')) {
      const value = arg.split('=').slice(1).join('=');
      if (!value) {
        console.error('Expected a role name after --role=');
        console.error(usage());
        process.exit(1);
      }
      roleNames.push(value);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length === 0) {
    console.error(usage());
    process.exit(1);
  }

  try {
    const results = await validatePlayersPresence({
      targets: positional,
      roleNames: roleNames.length > 0 ? roleNames : undefined,
      useId
    });

    const output = positional.length === 1 ? results[0] : results;
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
};

const isDirectExecution = (): boolean => {
  if (!process.argv[1]) return false;
  const entryUrl = pathToFileURL(process.argv[1]).href;
  return import.meta.url === entryUrl;
};

if (isDirectExecution()) {
  void main();
}
