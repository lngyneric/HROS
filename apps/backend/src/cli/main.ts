import { createCliContext, CliUsageError } from "./context.js";
import { cliFailed, createCliEvent } from "./output.js";
import { parseCliArgs } from "./parser.js";
import { runRegisteredCommand } from "./command-registry.js";

function exitCodeForStatus(status: "succeeded" | "blocked" | "failed") {
  return status === "succeeded" ? 0 : 1;
}

export async function runCli(argv: string[]) {
  const parsed = parseCliArgs(argv);

  try {
    const context = await createCliContext(parsed);
    return await runRegisteredCommand(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_cli_error";
    const code = error instanceof CliUsageError ? error.code : "cli_unhandled_error";

    return cliFailed({
      events: [
        createCliEvent("command_received", "ok", {
          commandName: parsed.commandName,
          argv: parsed.argv
        }),
        createCliEvent("command_failed", "failed", {
          code,
          message
        })
      ],
      result: {
        success: false,
        code,
        message
      }
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      process.exit(exitCodeForStatus(result.status));
    })
    .catch((error) => {
      const fallback = cliFailed({
        events: [
          createCliEvent("command_failed", "failed", {
            code: "cli_unhandled_error",
            message: error instanceof Error ? error.message : "unknown_cli_error"
          })
        ],
        result: {
          success: false,
          code: "cli_unhandled_error",
          message: error instanceof Error ? error.message : "unknown_cli_error"
        }
      });

      process.stdout.write(`${JSON.stringify(fallback, null, 2)}\n`);
      process.exit(1);
    });
}
