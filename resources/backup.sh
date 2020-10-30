#!/usr/bin/bash -l

echo "Starting backup!"
zip -r /minecraft_config/minecraft.zip /minecraft
aws s3 cp /minecraft_config/minecraft.zip s3://${AWS_BACKUP_BUCKET}/world.zip
aws s3 cp /minecraft_config/minecraft.zip s3://${AWS_BACKUP_BUCKET}/backups/$(date +%F_%T)/world.zip
echo "Backup Complete!"
echo
