#!/usr/bin/env node
import { S3DownloadOptions } from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import * as s3a from '@aws-cdk/aws-s3-assets';
import { MinecraftEc2Stack } from './ec2-stack';
import { MinecraftS3Stack } from './s3-stack';

const app = new cdk.App();

const env: cdk.Environment = {
    region: 'us-west-2',
}

const s3Stack = new MinecraftS3Stack(app, 'MinecraftS3Stack', {
    env,
    bucketName: 'grantapher-minecraft-cdk',
});

new MinecraftEc2Stack(app, 'MinecraftEc2Stack', {
    env,
    bucket: s3Stack.bucket,
    forgeVersion: '1.16.3-34.1.34',
    keyName: 'minecraft-ec2-keypair',
    minecraftServerPath: 'resources/minecraft.server',
    modsZipPath: 'resources/mods.zip',
    serverPropsPath: 'resources/server.properties',
});
