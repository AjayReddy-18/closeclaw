#!/usr/bin/env node
import { runCli } from "./cli.js";

void runCli(process.argv).then((code) => {
  process.exitCode = code;
});
