import { pathToFileURL } from "node:url";
import commandLineArgs, { type OptionDefinition } from "command-line-args";
import { languageNamed, type LanguageName } from "quicktype-core";
import {
  CSharpLanguageWithNexus,
  Generator,
  GoLanguageWithNexus,
  JavaLanguageWithNexus,
  parseFiles,
  PythonLanguageWithNexus,
  TypeScriptLanguageWithNexus,
  type GeneratorOptions,
} from "@nexus-rpc/gen-core";
import getUsage, { type Section } from "command-line-usage";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const supportedLanguages = [
  new CSharpLanguageWithNexus(),
  new GoLanguageWithNexus(),
  new JavaLanguageWithNexus(),
  new PythonLanguageWithNexus(),
  // TODO(cretz): new RubyTargetLanguage(),
  // TODO(cretz): new RustTargetLanguage(),
  new TypeScriptLanguageWithNexus(),
];

const commonOptionDefs = [
  { name: "help", alias: "h", type: Boolean, description: "Display help." },
  { name: "lang", description: "The target language." },
  {
    name: "out-dir",
    description: "Out directory. Mutually exclusive with --out-file.",
  },
  {
    name: "out-file",
    description: "Out file. Mutually exclusive with --out-dir.",
  },
  {
    name: "dry-run",
    type: Boolean,
    description: "Dump every file that would be written to stdout instead.",
  },
  { name: "files", multiple: true, defaultOption: true },
];

async function main(argv: string[]) {
  // Parse args with just lang and files
  const optionDefs: OptionDefinition[] = [...commonOptionDefs];
  let rawOptions = commandLineArgs(optionDefs, { argv, partial: true });
  if (rawOptions.help) {
    printUsage();
    return;
  }
  if (rawOptions.lang == null) {
    printUsage();
    throw new Error("--lang required");
  } else if (!rawOptions.files || !rawOptions.files.length) {
    printUsage();
    throw new Error("At least one file required");
  } else if (rawOptions["out-dir"] && rawOptions["out-file"]) {
    printUsage();
    throw new Error("Cannot provide both --out-dir and --out-file");
  }
  const lang = languageNamed(
    rawOptions.lang as LanguageName,
    supportedLanguages,
  );

  // Now parse args with language-specific options
  optionDefs.push(...lang.cliOptionDefinitions.actual);
  rawOptions = commandLineArgs(optionDefs, { argv });

  // Parse/validate YAML files
  const schema = await parseFiles(rawOptions.files);

  // Convert args to generator options structure
  const genOptions: GeneratorOptions = {
    lang,
    schema,
    rendererOptions: {},
    firstFilenameSansExtensions: path
      .basename(rawOptions.files[0])
      .split(".")[0],
  };
  for (const defn of lang.cliOptionDefinitions.actual) {
    const untypedRenderOptions = genOptions.rendererOptions as Record<
      typeof defn.name,
      unknown
    >;
    untypedRenderOptions[defn.name] = rawOptions[defn.name];
  }

  // Run generator
  const results = Object.entries(await new Generator(genOptions).generate());

  // Make result filenames absolute
  for (let index = 0; index < results.length; index++) {
    if (rawOptions["out-dir"]) {
      results[index][0] = path.join(rawOptions["out-dir"], results[index][0]);
    } else if (!rawOptions["dry-run"] && index > 0) {
      // Cannot use stdout or out-file in multi-file scenarios
      throw new Error(`Generated ${results.length} files, must use --out-dir`);
    } else if (rawOptions["out-file"]) {
      // Always overwrite filename, and disallow this arg in multi-file scenarios
      if (index > 0) {
        throw new Error(
          `Generated ${results.length} files, cannot provide single-file --out-file, use --out-dir`,
        );
      }
      results[index][0] = rawOptions["out-file"];
    }
  }

  // Dump
  for (const [filePath, fileContents] of results) {
    // Write with log for dry-run, stdout if no out, and file otherwise
    if (rawOptions["dry-run"]) {
      console.log(`--- ${filePath} ---\n${fileContents}\n-------`);
    } else if (!rawOptions["out-dir"] && !rawOptions["out-file"]) {
      // Note, validation from before means this only happens on single-file results
      process.stdout.write(fileContents);
    } else {
      // We make dirs lazily in dir-based scenarios
      if (rawOptions["out-dir"]) {
        await mkdir(path.dirname(filePath), { recursive: true });
      }
      console.log(`Writing ${filePath}`);
      await writeFile(filePath, fileContents);
    }
  }
}

function printUsage() {
  // Show shortest lang form
  const langNames = supportedLanguages.flatMap((l) =>
    l.names.reduce((a, b) => (a.length <= b.length ? a : b)),
  );
  // Common sections
  const tableOptions = {
    columns: [
      { name: "option", width: 60 },
      { name: "description", width: 60 },
    ],
  };
  const sections: Section[] = [
    {
      header: "Synopsis",
      content: [
        `$ nexus-rpc-gen [--lang LANG] [--out FILE/DIR] SCHEMA_FILE|URL ...`,
        "",
        `  LANG ... ${langNames.join("|")}`,
      ],
    },
    {
      header: "Description",
      content: "Generate code from Nexus RPC definition file.",
    },
    {
      header: "Options",
      optionList: commonOptionDefs,
      hide: ["files"],
      tableOptions,
    },
  ];
  // Add per-language sections
  for (const lang of supportedLanguages) {
    sections.push({
      header: `Options for ${lang.displayName}`,
      optionList: lang.cliOptionDefinitions.display,
      tableOptions,
    });
  }
  // Dump
  console.log(getUsage(sections));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    if (process.env.NEXUS_IDL_DEBUG) {
      console.error(error);
    } else {
      console.error(`${error}`);
    }
    process.exit(1);
  }
}
