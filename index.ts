import serverless from "serverless-http";
import express from "express";
import {
  APIGatewayProxyResult,
  APIGatewayProxyEvent,
  Context,
} from "aws-lambda";

const app = express();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const serverlessHandler = serverless(app);

export async function handler(event: APIGatewayProxyEvent, context: Context) {
  const result = await serverlessHandler(event, context);
  return result as APIGatewayProxyResult;
}
