#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { MinecraftStack } from '../lib/minecraft-stack';

const app = new cdk.App();
new MinecraftStack(app, 'MinecraftStack');
