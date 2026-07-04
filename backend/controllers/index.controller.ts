import {prisma} from "../config/prisma";
import{  type Request, type Response } from "express";
import {client} from "../lib/redis";
interface SubmissionParams {
  submissionId: string;
}
export const submitCode = async (req: Request, res: Response) => {
  const { code, language, userId } = req.body;

  try {
    const newSubmission = await prisma.submissions.create({
      data: {
        code,
        language,
       
        status: "Processing",
        output: null,
      },
    });

await client.send("LPUSH", [
  "submission-queue",
  JSON.stringify({
    submissionId: newSubmission.id,
    code,
    language,
  }),
]);

    res.status(201).json({
      message: "Submission queued successfully",
      submissionId: newSubmission.id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to submit code",
    });
  }
};


export const getSubmissionResult = async (
  req: Request<SubmissionParams>,
  res: Response
) => {
  const { submissionId } = req.params;

  try {
    const response = await prisma.submissions.findUnique({
      where: {
        id: submissionId,
      },
    });

    if (!response) {
      return res.status(404).json({
        error: "Submission not found",
      });
    }

    return res.status(200).json({
      submission: response,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Failed to fetch submission result",
    });
  }
};