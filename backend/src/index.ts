import express from "express";
import cors from "cors";
import mainRoute from "../routes/index.routes";
const app = express();

app.use(express.json());

app.use(cors());

app.use("/api", mainRoute);


app.get("/", (req, res) => {
  res.send("Hello from Express!");
});







app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
