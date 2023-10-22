Provision ECR:

```sh
aws --region us-west-2 \
  cloudformation deploy \
  --template-file cloudformation-ecr.yaml \
  --stack-name TestEcr
```

Read the output of the cluster:

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

Login to ECR with Docker:

```sh
aws --region us-west-2 ecr get-login-password \
  | docker login <ecr_uri> \
  --username AWS \
  --password-stdin
```

Build and tag the image with the ECR URI:

```sh
docker tag <local_image_name> <ecr_uri>:<version>
```

Push the image to ECR:

```sh
docker push <ecr_uri>:<version>
```

```sh
aws cloudformation deploy \
  --region us-west-2 \
  --template-file cloudformation-resources.yaml \
  --stack-name TestResources \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    LambdaFunctionImageUri="<ecr_uri>:<version>"
```
