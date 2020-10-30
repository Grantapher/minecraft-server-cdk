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
  /** EIP to attach to the ec2 instance. */
  readonly elasticIp?: ec2.CfnEIP
}

export class MinecraftEc2Stack extends cdk.Stack {
  readonly ec2Instance: ec2.Instance

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

    this.ec2Instance = new ec2.Instance(this, 'Ec2Instance', {
      vpc,
      securityGroup,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      machineImage: ec2.MachineImage.lookup({
        name: 'amzn2-ami-hvm*',
        owners: ['amazon'],
      }),
      vpcSubnets: {subnetType: ec2.SubnetType.PUBLIC},
      keyName: props.keyName,
    })

    props.bucket.grantReadWrite(this.ec2Instance).assertSuccess()
    props.bucket.grantDelete(this.ec2Instance).assertSuccess()

    const addDownload = (path: string, localFile: string) => {
      const asset = new s3a.Asset(this, `Asset-${localFile}`, {path})

      asset.grantRead(this.ec2Instance)

      this.ec2Instance.userData.addS3DownloadCommand({
        bucket: asset.bucket, 
        bucketKey: asset.s3ObjectKey,
        localFile,
      })
    };

    const envVars = {
      AWS_BACKUP_BUCKET: props.bucket.bucketName,
      FORGE_VERSION: props.forgeVersion,
    }
    const envVarCommands = Object.entries(envVars).map(([envVar, value]) => `export ${envVar}="${value}"`)
    this.ec2Instance.userData.addCommands(...envVarCommands)
    // so that cron can pick them up
    this.ec2Instance.userData.addCommands(...envVarCommands.map(command => `sudo -u ec2-user echo '${command}' >> /home/ec2-user/.bash_profile`))
  
    const addCronScript = (cron: string, script: string) => 
      this.ec2Instance.userData.addCommands(
        `sudo -u ec2-user crontab -l | grep '${script}' || (sudo -u ec2-user crontab -l 2>/dev/null; echo "${cron} ${script} >> ${script}.log 2>&1") | sudo -u ec2-user crontab -`);

    this.ec2Instance.userData.addCommands(
      'sudo yum install -y java-11-amazon-corretto',
      'sudo mkdir /minecraft_config',
      'sudo chown -R ec2-user:ec2-user /minecraft_config',
      'mkdir /minecraft_config/bin',
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
      this.ec2Instance.userData.addCommands(
        `unzip ${modsZipLocalPath}`,
        `rm -f ${modsZipLocalPath}`,
        )
    }

    addDownload(props.minecraftServerPath, '/etc/systemd/system/minecraft.service')
    addDownload('resources/backup.sh', '/minecraft_config/bin/backup.sh')
    addDownload('resources/download_previous.sh', '/minecraft_config/bin/download_previous.sh')
    addDownload('resources/setup.sh', '/minecraft_config/bin/setup.sh')
    this.ec2Instance.userData.addCommands(
      `sudo chown ec2-user:ec2-user -R /minecraft_config/bin`,
      `sudo chmod 755 -R /minecraft_config/bin`,
    )
    addCronScript('*/15 * * * *', '/minecraft_config/bin/backup.sh')
    this.ec2Instance.userData.addCommands('/minecraft_config/bin/setup.sh');

    let ip
    if (props.elasticIp) {
      ip = props.elasticIp.ref
      new ec2.CfnEIPAssociation(this, 'ea', {
        eip: ip,
        instanceId: this.ec2Instance.instanceId
      });
    } else {
      ip = this.ec2Instance.instancePublicIp
    }

    new cdk.CfnOutput(this, 'ServerIp', {
      exportName: 'ServerIp',
      description: 'IP Address used to login to the server.',
      value: `${ip}:25565`,
    })
  }  
}
