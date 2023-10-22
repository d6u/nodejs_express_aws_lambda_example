import { createServer } from "node:http";
import { createSchema, createYoga } from "graphql-yoga";
import serverless, { Application } from "serverless-http";

const yoga = createYoga({
  schema: createSchema({
    typeDefs: /* GraphQL */ `
      type Query {
        hello: String
      }
    `,
    resolvers: {
      Query: {
        hello: () => "Hello from Yoga!",
      },
    },
  }),
});

const server = createServer(yoga);

export const handler = serverless(server as Application);
