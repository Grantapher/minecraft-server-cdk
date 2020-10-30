#!/usr/bin/bash -l

echo "Starting setup!"
if ! /minecraft_config/bin/download_previous.sh; then
    echo "Previous save not found creating new world..."
    curl -o forge-installer.jar https://files.minecraftforge.net/maven/net/minecraftforge/forge/${FORGE_VERSION}/forge-${FORGE_VERSION}-installer.jar
    java -jar forge-installer.jar --installServer
    sudo rm -rf forge-installer*
    echo 'eula=true' > eula.txt
fi

sudo chown ec2-user:ec2-user -R /minecraft*
sudo systemctl daemon-reload
sudo service minecraft start
echo "Setup complete!"
