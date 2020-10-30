#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import { MinecraftEc2Stack } from './ec2-stack';
import { MinecraftS3Stack } from './s3-stack';

const app = new cdk.App();

const env: cdk.Environment = {
    account: '418390728672',
    region: 'us-west-2',
}

const s3Stack = new MinecraftS3Stack(app, 'MinecraftS3Stack', {
    env,
    bucketName: 'grantapher-minecraft-cdk',
});

const eipStack = new class extends cdk.Stack {
    readonly eip: ec2.CfnEIP
    constructor(scope: cdk.App, id: string, props: cdk.StackProps) {
        super(scope, id, props)
        this.eip = new ec2.CfnEIP(this, 'Server IP');
    }
}(app, 'ElasticIpStack', {env});

new MinecraftEc2Stack(app, 'MinecraftEc2Stack', {
    env,
    bucket: s3Stack.bucket,
    forgeVersion: '1.16.3-34.1.34',
    keyName: 'minecraft-ec2-keypair',
    minecraftServerPath: 'resources/minecraft.server',
    modsZipPath: 'resources/mods.zip',
    serverPropsPath: 'resources/server.properties',
    elasticIp: eipStack.eip,
});
