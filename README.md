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

4. Login to ECR with Docker:

   ```sh
   aws --region us-west-2 ecr get-login-password \
     | docker login <ecr_uri> \
     --username AWS \
     --password-stdin
   ```

5. Push the image to ECR:

   ```sh
   docker push <ecr_uri>:<version>
   ```

6. Deploy the CloudFormation stack:

   ```sh
   aws cloudformation deploy \
     --region us-west-2 \
     --template-file cloudformation-resources.yaml \
     --stack-name TestResources \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides \
       LambdaFunctionImageUri="<ecr_uri>:<version>"
   ```

## Important Notes

- [serverless-http](https://www.npmjs.com/package/serverless-http) is the library to convert a regular Express app into a lambda handler.
- Docker image must use arm64 version, i.e. `public.ecr.aws/lambda/nodejs:18-arm64`, which matches the `Architectures` property of the lambda function.
- `SourceArn` of the lambda permission must be `arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiGatewayApiHttp.ApiId}/*/*/`, where it ends with `/*/*/` instead of `/*/*/*`.

  Because the `AWS::ApiGatewayV2::Api` resource only has one `AWS::ApiGatewayV2::Route` with `RouteKey` set to `GET /`, it doesn't have route mapped to `/*`. (See https://docs.aws.amazon.com/apigateway/latest/developerguide/arn-format-reference.html for ARN format for API Gateway.)
