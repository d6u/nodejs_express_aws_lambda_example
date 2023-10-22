## Intro

- See `index.ts` for example for GraphQL setup.
- See `express.ts` for example for Express setup with `GET /`

## Deployment

1. (One time setup) Provision ECR:

   ```sh
   aws --region us-west-2 \
     cloudformation deploy \
     --template-file cloudformation-ecr.yaml \
     --stack-name TestEcr
   ```

2. Read the output of the stack to get the ECR URI:

   ```sh
   aws --region us-west-2 \
     cloudformation describe-stacks \
     --stack-name TestEcr \
     | jq ".Stacks[0].Outputs"
   ```

   Example output:

   ```json
   [
     {
       "OutputKey": "RepositoryUriForLambda",
       "OutputValue": "<ecr_uri>"
     }
   ]
   ```

3. Build the image and tag with the ECR URI:

   ```
   docker build -t <ecr_uri>:<version> .
   ```

   (Optional) We can tag the image with ECR URI later:

   ```sh
   docker tag <local_image_name> <ecr_uri>:<version>
   ```

4. (Optional) Test the function locally:

   ```sh
   docker run -p 9000:8080 <ecr_uri>:<version>
   ```

   In a separate terminal, run:

   ```sh
   curl "http://localhost:9000/2015-03-31/functions/function/invocations" \
     -d '{"payload":"hello world!"}'
   ```

   - `-d '{"payload":"hello world!"}'` will only work for `GET /` route in Express.

5. Login to ECR with Docker:

   ```sh
   aws --region us-west-2 ecr get-login-password \
     | docker login <ecr_uri> \
     --username AWS \
     --password-stdin
   ```

6. Push the image to ECR:

   ```sh
   docker push <ecr_uri>:<version>
   ```

7. Deploy the CloudFormation stack:

   ```sh
   aws cloudformation deploy \
     --region us-west-2 \
     --template-file cloudformation-resources.yaml \
     --stack-name TestResources \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides \
       LambdaFunctionImageUri="<ecr_uri>:<version>"
   ```

8. (Optional) Test the endpoint (GraphQL API):

   ```sh
   curl 'https://<api_gateway_domain>/graphql' \
     -H 'content-type: application/json' \
     -d '{"query":"{ hello }"}'
   ```

   - `-H 'content-type: application/json'` is required for GraphQL requests.

## Important Notes

- [serverless-http](https://www.npmjs.com/package/serverless-http) is the library to convert a regular Express app into a lambda handler.
- Docker image must use arm64 version, i.e. `public.ecr.aws/lambda/nodejs:18-arm64`, which matches the `Architectures` property of the lambda function.
- The resource-path part of `SourceArn` of `AWS::Lambda::Permission` must match the `AWS::ApiGatewayV2::Route`'s ARN. Otherwise, it will show as error in Lambda > Triggers section of AWS Console. For example:

  - If `AWS::ApiGatewayV2::Route` has `RouteKey` set to `GET /`, then the `SourceArn` should be `arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiGatewayApiHttp.ApiId}/*/*/`, where it ends with `/*/*/` instead of `/*/*/*`. Because `AWS::ApiGatewayV2::Route` didn't define path `/*`.
  - For `POST /graphql`, it should be `arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiGatewayApiHttp.ApiId}/*/*/graphql`.

  See https://docs.aws.amazon.com/apigateway/latest/developerguide/arn-format-reference.html for ARN format for API Gateway. The stage and http-method part can still be "\*".
