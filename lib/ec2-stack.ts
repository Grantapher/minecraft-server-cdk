import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as s3 from '@aws-cdk/aws-s3';
import * as s3a from '@aws-cdk/aws-s3-assets';

export interface MinecraftEc2StackProps extends cdk.StackProps {
  /** Bucket to use for storage. */
  readonly bucket: s3.Bucket
  /** Which forge version to download. */
  readonly forgeVersion: string
  /** The path to the default minecraft server script. */
  readonly minecraftServerPath: string
  /** The path to the mods zip file. @default to no mods. */
  readonly modsZipPath?: string
  /** The path to the server properties file. @default to default server settings. */
  readonly serverPropsPath?: string
  /** The keypair to launch with. Without it, you won't be able to ssh to the host. */
  readonly keyName?: string
}

export class MinecraftEc2Stack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: MinecraftEc2StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 1,
    })

    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'Allow ssh access to ec2 instances',
      allowAllOutbound: true   // Can be set to false
    });    
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'allow ssh access from the world');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(25565), 'minecraft clients tcp');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(25565), 'minecraft clients udp');

    const instance = new ec2.Instance(this, 'Ec2Instance', {
      vpc,
      securityGroup,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      machineImage: ec2.MachineImage.genericLinux({'us-west-2': 'ami-0528a5175983e7f28'}),
      vpcSubnets: {subnetType: ec2.SubnetType.PUBLIC},
      keyName: props.keyName,
    })

    props.bucket.grantReadWrite(instance).assertSuccess()
    props.bucket.grantDelete(instance).assertSuccess()

    const addDownload: (path: string, localFile: string) => void = 
      (path, localFile) => {
        const asset = new s3a.Asset(this, `Asset-${localFile}`, {path})

        asset.grantRead(instance)

        instance.userData.addS3DownloadCommand({
          bucket: asset.bucket, 
          bucketKey: asset.s3ObjectKey,
          localFile,
        })
      };
    
    instance.userData.addCommands(
      'sudo yum install -y java-11-amazon-corretto',
      'sudo mkdir /minecraft',
      'sudo chown -R ec2-user:ec2-user /minecraft',
      'cd /minecraft',
    );

    if (props.serverPropsPath) {
      addDownload(props.serverPropsPath, 'server.properties')
    }

    if (props.modsZipPath) {
      const modsZipLocalPath = 'mods.zip'
      addDownload(props.modsZipPath, modsZipLocalPath)
      instance.userData.addCommands(`unzip ${modsZipLocalPath}`)
    }

    //todo this can probably be generated rather than having a copy of the file
    addDownload(props.minecraftServerPath, '/etc/systemd/system/minecraft.service')

    const forgeUrl = 
      `https://files.minecraftforge.net/maven/net/minecraftforge/forge/${props.forgeVersion}/forge-${props.forgeVersion}-installer.jar`

    instance.userData.addCommands(
      `curl -o forge-installer.jar ${forgeUrl}`,
      'java -jar forge-installer.jar --installServer',
      "echo 'eula=true' > eula.txt",
      'sudo systemctl daemon-reload',
      'sudo service minecraft start',
    );

    new cdk.CfnOutput(this, 'Server Address', {
      exportName: 'ServerAddress',
      description: 'The Server Address to use in minecraft',
      value: `${instance.instancePublicIp}:25565`,
    })
  }  
}
