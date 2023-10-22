import serverless from "serverless-http";
import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

export const handler = serverless(app);
