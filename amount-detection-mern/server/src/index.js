import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import dotenv from "dotenv";
import amountRouter from "./routes/amount.js";

dotenv.config();
const app = express();


app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(fileUpload({
  useTempFiles: false,
  createParentPath: true
}));

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "AI-Powered Amount Detection" });
});

app.use("/api/v1", amountRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
