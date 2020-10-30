#!/usr/bin/bash -l

echo "Downloading previous save"
if aws s3 cp s3://${AWS_BACKUP_BUCKET}/world.zip /minecraft_config/minecraft.zip; then
    sudo service minecraft stop
    sudo rm -rf /minecraft/*
    unzip /minecraft_config/minecraft.zip -d /minecraft
    mv /minecraft/minecraft/* /minecraft
    rm -rf /minecraft/minecraft
    echo "Download complete."
    exit 0
fi

echo "Previous save not found."

exit 1
