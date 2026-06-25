export type CliFlagValue = string | boolean;

export type ParsedCliCommand = {
  group: string;
  command: string;
  commandName: string;
  rawCommand: string;
  argv: string[];
  flags: Record<string, CliFlagValue>;
  positionals: string[];
};

function toCamelCase(value: string) {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function setFlag(flags: Record<string, CliFlagValue>, key: string, value: CliFlagValue) {
  flags[key] = value;
  flags[toCamelCase(key)] = value;
}

export function parseCliArgs(argv: string[]): ParsedCliCommand {
  const [group = "", command = "", ...rest] = argv;
  const flags: Record<string, CliFlagValue> = {};
  const positionals: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (!token) {
      continue;
    }

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const withoutPrefix = token.slice(2);

    if (withoutPrefix.includes("=")) {
      const [key, ...valueParts] = withoutPrefix.split("=");
      setFlag(flags, key, valueParts.join("="));
      continue;
    }

    const nextToken = rest[index + 1];

    if (!nextToken || nextToken.startsWith("--")) {
      setFlag(flags, withoutPrefix, true);
      continue;
    }

    setFlag(flags, withoutPrefix, nextToken);
    index += 1;
  }

  const normalizedGroup = group.trim().toLowerCase();
  const normalizedCommand = command.trim().toLowerCase();

  return {
    group: normalizedGroup,
    command: normalizedCommand,
    commandName: `hros ${normalizedGroup} ${normalizedCommand}`.trim(),
    rawCommand: `hros ${argv.join(" ")}`.trim(),
    argv,
    flags,
    positionals
  };
}

export function getFlagString(
  flags: Record<string, CliFlagValue>,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const value = flags[name];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

export function getFlagBoolean(
  flags: Record<string, CliFlagValue>,
  ...names: string[]
): boolean {
  for (const name of names) {
    const value = flags[name];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return value === "true";
    }
  }

  return false;
}
