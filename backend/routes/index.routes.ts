import express from "express";
import {getSubmissionResult, submitCode,} from "../controllers/index.controller";
const router = express.Router();


router.post("/problems/submission", submitCode);
router.get("/problems/submission/:submissionId", getSubmissionResult);    

export default router;
