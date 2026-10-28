# Archviz roadmap

<!-- TODO(Joseph): reorder or trim to match your real priorities before submitting. -->

Archviz today turns an AWS diagram into reviewable Terraform: 26 palette resources, live constraint checks, three export layouts, a local runner for `terraform plan` and LocalStack apply, and an MCP server for AI clients. This is the work ahead. Detailed, per-resource notes live in [`docs/aws-coverage.md`](docs/aws-coverage.md), and each item below links to its GitHub issue.

## Now: deepen what's already on the canvas (P1)

- [ ] SNS → Lambda subscription, with the invoke permission ([#17](https://github.com/codeupllc/archviz/issues/17))
- [ ] ALB HTTPS listener with an ACM certificate connection ([#14](https://github.com/codeupllc/archviz/issues/14))
- [ ] S3 versioning, encryption and public-access-block companions ([#13](https://github.com/codeupllc/archviz/issues/13))
- [ ] IAM Role: suggest a trust policy from what it's connected to (ECS, Lambda, EC2) ([#23](https://github.com/codeupllc/archviz/issues/23))
- [ ] Persist LocalStack ECS URLs and prefer the API service for "Open UI" ([PR #35](https://github.com/codeupllc/archviz/pull/35), in review)

## Next: common architecture building blocks (P1)

- [ ] CloudFront distribution ([#4](https://github.com/codeupllc/archviz/issues/4))
- [ ] Route 53 zone and records ([#5](https://github.com/codeupllc/archviz/issues/5))
- [ ] ACM certificate ([#6](https://github.com/codeupllc/archviz/issues/6))
- [ ] VPC endpoint ([#7](https://github.com/codeupllc/archviz/issues/7))
- [ ] NAT Gateway and Elastic IP ([#8](https://github.com/codeupllc/archviz/issues/8))
- [ ] Auto Scaling Group and Launch Template ([#10](https://github.com/codeupllc/archviz/issues/10))
- [ ] EventBridge rule and target ([#11](https://github.com/codeupllc/archviz/issues/11))
- [ ] Cognito user pool and client ([#12](https://github.com/codeupllc/archviz/issues/12))

## Later: specialized services (P2)

- [ ] SQS dead-letter queue via a `redrive_policy` connection, plus FIFO name validation ([#18](https://github.com/codeupllc/archviz/issues/18))
- [ ] WAF web ACL ([#19](https://github.com/codeupllc/archviz/issues/19))
- [ ] Kinesis data stream ([#20](https://github.com/codeupllc/archviz/issues/20))
- [ ] Step Functions state machine ([#21](https://github.com/codeupllc/archviz/issues/21))
- [ ] EKS cluster and node group ([#22](https://github.com/codeupllc/archviz/issues/22))

## Generator and tooling

- [ ] Opt-in `backend` block generation (S3 + DynamoDB lock, or Terraform Cloud), so exports are ready for shared state. This is the next step called out in the README's scope section.
- [ ] Replace the `# TODO: configure backend` stubs in multi-service exports with that generated backend.
- [ ] RDS / Aurora subnet-group companion, Lambda event source mappings for DynamoDB Streams and Kinesis, and managed-policy attachments on IAM roles (see "Deepen existing nodes" in `docs/aws-coverage.md`).
- [ ] Add a real linter (the packages' `lint` scripts are placeholders today).

## Deliberately out of scope

Applying to real AWS from the UI, managing remote state for you, and storing secret values stay out on purpose. See [Scope and non-goals](README.md#scope-and-non-goals).
