import cors from "cors";
import "dotenv/config";
import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "m2-gamified-agent-be"
  });
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
