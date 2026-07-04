import fs from "fs";
import { spawn } from "child_process";
import { client } from "./lib/redis";
import { prisma } from "./config/prisma";

async function startWorker() {
  console.log("🚀 Worker started...");

  while (true) {
    // Wait until a job is available
    console.log("⏳ Waiting for job...");
    const result = await client.send("BRPOP", [
      "submission-queue",
      "0",
    ]);
console.log("📦 Got job:", result);
    if (!result) continue;

    const [, payload] = result as [string, string];
    const parsedResponse = JSON.parse(payload);

    const code = parsedResponse.code;
    const language = parsedResponse.language;
    const submissionId = parsedResponse.submissionId;

    console.log(`Processing submission ${submissionId}`);

    let finalOutput = "";

    try {
      if (language === "cpp") {
        console.log("Running C++ code");

 const filePath =
`${__dirname}/code/${submissionId}.cpp`;
        fs.writeFileSync(filePath, code);

        const compiler = spawn("g++", [
          filePath,
          "-o",
          "./code/out",
        ]);

        let compileSuccess = true;

        await new Promise<void>((resolve) => {
          compiler.on("exit", (code) => {
            if (code !== 0) {
              compileSuccess = false;
            }
            resolve();
          });
        });

        if (!compileSuccess) {
          await prisma.submissions.update({
            where: { id: submissionId },
            data: {
              status: "Failure",
            },
          });

          continue;
        }

        const runner = spawn("./code/out");

        runner.stdout.on("data", (chunk) => {
          finalOutput += chunk.toString();
        });

        await new Promise<void>((resolve) => {
          runner.on("exit", async (code) => {
            if (code === 0) {
              await prisma.submissions.update({
                where: { id: submissionId },
                data: {
                  status: "Success",
                  output: finalOutput,
                },
              });
            } else {
              await prisma.submissions.update({
                where: { id: submissionId },
                data: {
                  status: "Failure",
                },
              });
            }

            resolve();
          });
        });
      }

      if (language === "js") {
        const filePath = __dirname + "/code/a.js";

        fs.writeFileSync(filePath, code);

        const runner = spawn("node", [filePath]);

        runner.stdout.on("data", (chunk) => {
          finalOutput += chunk.toString();
        });

        await new Promise<void>((resolve) => {
          runner.on("exit", async (code) => {
            if (code === 0) {
              await prisma.submissions.update({
                where: { id: submissionId },
                data: {
                  status: "Success",
                  output: finalOutput,
                },
              });
            } else {
              await prisma.submissions.update({
                where: { id: submissionId },
                data: {
                  status: "Failure",
                },
              });
            }

            resolve();
          });
        });
      }

      if (language === "py") {
        const filePath = __dirname + "/code/a.py";

        fs.writeFileSync(filePath, code);

        const runner = spawn("python3", [filePath]);

        runner.stdout.on("data", (chunk) => {
          finalOutput += chunk.toString();
        });

        await new Promise<void>((resolve) => {
          runner.on("exit", async (code) => {
            if (code === 0) {
              await prisma.submissions.update({
                where: { id: submissionId },
                data: {
                  status: "Success",
                  output: finalOutput,
                },
              });
            } else {
              await prisma.submissions.update({
                where: { id: submissionId },
                data: {
                  status: "Failure",
                },
              });
            }

            resolve();
          });
        });
      }
    } catch (err) {
      console.error(err);

      await prisma.submissions.update({
        where: { id: submissionId },
        data: {
          status: "Failure",
        },
      });
    }
  }
}

startWorker();