import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';

export interface MinecraftS3StackProps extends cdk.StackProps {
    /** Optional name of the bucket. */
    readonly bucketName?: string
}

export class MinecraftS3Stack extends cdk.Stack {
  readonly bucket: s3.Bucket

  constructor(scope: cdk.App, id: string, props?: MinecraftS3StackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, 'Bucket', {
        bucketName: props?.bucketName,
        lifecycleRules: [{
          expiration: cdk.Duration.days(30),
          prefix: 'backups',
        }],
    })
  }
}
