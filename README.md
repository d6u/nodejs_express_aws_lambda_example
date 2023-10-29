## Intro

- See `index.ts` for example for GraphQL setup.
- See `express.ts` for example for Express setup with `GET /`
- Using AWS SAM CLI `sam` is probably the easiest way to deploy lambda based applications.

## Deployment with AWS SAM

### Important files:

- `samconfig.toml`: AWS SAM configuration file.
- `cloudformation-resources-v3.yaml`: AWS SAM template file, essentially a CloudFormation template file. By default this should be named `template.yaml`.
  - This is almost the same as `cloudformation-resources-v2.yaml`. But running `sam build` will automatically build the image based on the `Metadata` field.

### Steps

1. Prepare the application for later deployment or local testing:

   ```sh
   sam build -t cloudformation-resources-v3.yaml
   ```

   - If template is called `template.yaml`, `-t` option can be omitted.

2. Deploy the application:

   ```sh
   sam deploy
   ```

   - If there is `samconfig.toml` created already or running deploy for the first time, we can add `--guided`.
   - No need to use `-t cloudformation-resources-v3.yaml` like `sam build`, because this will actually use `.aws-sam/build/template.yaml` created in `sam build` step.

### Clean Up

Delete the stack:

```sh
sam delete
```

- No need to use `-t cloudformation-resources-v3.yaml`, because needed information is stored

## Deployment with CloudFormation directly

### Steps

1. (One time setup) Provision ECR:

   ```sh
   aws --region us-west-2 \
     cloudformation deploy \
     --template-file cloudformation-ecr.yaml \
     --stack-name TestEcr
   ```

2. Read the output of the stack to get the ECR URI for future steps:

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
   aws --region us-west-2 cloudformation deploy \
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

### Clean Up

1. Delete the stacks (both `TestResources` and `TestEcr`):

   ```sh
   aws --region us-west-2 cloudformation delete-stack \
     --stack-name TestResources
   ```

2. Delete the ECR:

   1. (Optional) List the images:

      ```sh
      aws --region us-west-2 ecr list-images \
        --repository-name <ecr_name>
      ```

   2. Delete all images:

      ```sh
      aws --region us-west-2 ecr batch-delete-image \
        --repository-name <ecr_name> \
        --image-ids imageTag=v1 imageTag=v2
      ```

   3. Delete the repository:

      ```sh
      aws --region us-west-2 cloudformation delete-stack \
        --stack-name TestEcr
      ```

## Important Notes

- [serverless-http](https://www.npmjs.com/package/serverless-http) is the library to convert a regular Express app into a lambda handler.

- Docker image must use arm64 version, i.e. `public.ecr.aws/lambda/nodejs:18-arm64`, which matches the `Architectures` property of the lambda function.

- `AWS::Serverless::Function` is used instead of `AWS::Lambda::Function` so we don't have to create IAM roles and policies for the lambda function ourselves.

- In `cloudformation-resources-v1.yaml`, the `SourceArn` field of `AWS::Lambda::Permission` can be ignored. If you want to specify it, the resource-path must match the `AWS::ApiGatewayV2::Route`'s ARN. Otherwise, it will show as error in Lambda > Triggers section of AWS Console. For example:

  - If `AWS::ApiGatewayV2::Route` has `RouteKey` set to `GET /`, then the `SourceArn` should be `arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiGatewayApiHttp.ApiId}/*/*/`, where it ends with `/*/*/` instead of `/*/*/*`. Because `AWS::ApiGatewayV2::Route` didn't define path `/*`.
  - For `POST /graphql`, it should be `arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiGatewayApiHttp.ApiId}/*/*/graphql`.

  See https://docs.aws.amazon.com/apigateway/latest/developerguide/arn-format-reference.html for ARN format for API Gateway. The stage and http-method part can still be "\*".

- In `cloudformation-resources-v2.yaml`, we used `AWS::Serverless::Api` to simplify the creation of API Gateway.
